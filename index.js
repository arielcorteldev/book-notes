// Import Modules
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import dotenv from 'dotenv';
import session from 'express-session';
import flash from 'connect-flash';

// Setup dotenv
dotenv.config();

// Initialize express app with port 3000
const app = express();
const port = 3000;

// Set pg to not convert DATE columns into JS Date objects - just return the raw value
const { types } = pg;
types.setTypeParser(1082, (val) => val);

// Initialized and connect to PostgreSQL db (store db credentials in .env)
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
db.connect();

// Middlewares
app.use(express.static("public")); // to acccess public folder (for css)
app.set("view engine", "ejs"); // to set views engine as  ejs (views folder)
app.use(bodyParser.urlencoded({ extended: true })); // to parse incoming req and have a body you can acess
app.use(bodyParser.json()); // to set bodyparser to auto-parse req to JSON bodies
// Sets up express session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));
app.use(flash()); // to use connect-flash

// Date validation
// Checks if date is valid and not empty
function isValidDateRead(dateStr) {
  if (!dateStr) return false; // required check

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false; // format check

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false; // actually parses to a real date

  // confirm it round-trips correctly (catches Feb 30, month 13, etc.)
  const [year, month, day] = dateStr.split("-").map(Number);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  )
    return false;

  return true;
}

// Checks if date is not set to a future date
function isNotFuture(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // allow today, reject only strictly future dates
  return date <= today;
}

// ISBN validation
function isValidISBN(isbn) {
  if (!isbn) return true; // optional field, blank is valid

  const cleaned = isbn.replace(/-/g, "").toUpperCase();

  if (cleaned.length === 10) {
    return isValidISBN10(cleaned);
  } else if (cleaned.length === 13) {
    return isValidISBN13(cleaned);
  }

  return false; // wrong length
}

// Validate ISBN with 10 digits
function isValidISBN10(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false; // first 9 digits, last digit or 'X'

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(isbn[i]) * (10 - i);
  }
  const lastChar = isbn[9];
  sum += (lastChar === "X" ? 10 : parseInt(lastChar)) * 1;

  return sum % 11 === 0;
}

// Validate ISBN with 13 digits
function isValidISBN13(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false; // all 13 must be digits

  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const weight = i % 2 === 0 ? 1 : 3;
    sum += parseInt(isbn[i]) * weight;
  }

  return sum % 10 === 0;
}

// Full book validation
function validateBook(book) {
  // errors object to store error keys linked to each field
  const errors = {};

  // check if title is not empty and if not more than 200 chars
  if (!book.title || book.title.trim() === "") {
    errors.title = "Enter the book title.";
  } else if (book.title.length > 200) {
    errors.title = "Title must be 200 characters or fewer.";
  }

  // check if author is not empty and if not more than 200 chars
  if (!book.author || book.author.trim() === "") {
    errors.author = "Enter the author's name.";
  } else if (book.author.length > 200) {
    errors.author = "Author must be 200 characters or fewer.";
  }

  // check if ISBN is valid format
  if (!isValidISBN(book.isbn)) {
    errors.isbn = "This ISBN doesn't look valid - check for typos.";
  }

  // check if rating is NaN (empty), if less than 1 or greather than 5
  if (isNaN(book.rating) || book.rating < 1 || book.rating > 5) {
    errors.rating = "Please select a rating between 1 and 5.";
  }

  // check if notes is empty and if not more than 1000 chars
  if (!book.notes || book.notes.trim() === "") {
    errors.notes = "Add a summary note for this book.";
  } else if (book.notes.length > 1000) {
    errors.notes = "Notes can't exceed 1000 characters.";
  }

  // check if date read is a valid date and not set to a future date
  if (!isValidDateRead(book.date_read)) {
    errors.date_read = "Please enter a valid date.";
  } else if (!isNotFuture(book.date_read)) {
    errors.date_read = "The date read can't be in the future.";
  }

  // return the errors object
  return errors;
}

// Checks if a book has a cover from Open Library API
async function coverExists(isbn) {
  if (!isbn) return false; // checks if isbn is empty - return false

  try {
    // GET request to Open Library to retrieve book cover via ISBN
    await axios.get(
      `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`,
    );
    // if request successful, return true
    return true;
  } catch (error) {
    // if request unsuccessful, log error and return false
    console.error("Cover check failed: ", error.message);
    return false;
  }
}

// Custom middleware to make every single incoming request check if there's a flash message initiated in the previous route
app.use((req, res, next) => {
  res.locals.successMessage = req.flash("success"); 
  res.locals.errorMessage = req.flash("error");
  next();
})

// GET / - home page
app.get("/", async (req, res) => {
  // Object keys for sort options
  const sortOptions = {
    date_desc: { column: "date_read", direction: "DESC" },
    date_asc: { column: "date_read", direction: "ASC" },
    rating_desc: { column: "rating", direction: "DESC" },
    rating_asc: { column: "rating", direction: "ASC" },
  };

  // Get the column and direction set by user if any, by default use date_desc
  const { column, direction } =
    sortOptions[req.query.sort] || sortOptions.date_desc;

  
  try {
    // db query to get all books ordered by sortOptions
    const result = await db.query(
      `SELECT * FROM books ORDER BY ${column} ${direction}`,
    );
    const books = result.rows;

    // check all books if it has a cover via coverExists()
    const booksWithCoverFlag = await Promise.all(
      books.map(async (book) => ({
        ...book,
        hasCover: await coverExists(book.isbn),
      })),
    );
    
    // render index.ejs and passed value of booksWithCoverFlag
    res.render("index.ejs", { books: booksWithCoverFlag });
  } catch (error) {
    // if there's an error, log error and flash an error and a message and redirect to /
    console.error(error);
    req.flash("error", "Something went wrong. Please try again in a moment.")
    res.redirect("/");
  }
});

// GET /books/new - render add book page (new.ejs)
app.get("/books/new", (req, res) => {
  res.render("new.ejs");
});

// POST /books - save new book
app.post("/books", async (req, res) => {
  // build newBook object from form
  const newBook = {
    title: req.body.title,
    author: req.body.author,
    isbn: req.body.isbn ? req.body.isbn.replace(/-/g, "").toUpperCase() : null, // if isbn is provided, if not, set value to null
    rating: parseInt(req.body.rating),
    notes: req.body.notes,
    date_read: req.body.date_read,
  };

  // run validateBook() to newBook and get any errors
  const errors = validateBook(newBook);

  // check if there are validation errors
  if (Object.keys(errors).length > 0) {
    // if yes return and render new.ejs with the newBook values and errors
    return res.render("new.ejs", { book: newBook, errors });
  }

  try {
    // db query to insert the newBook values to books table
    await db.query(
      "INSERT INTO books (title, author, isbn, rating, notes, date_read) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        newBook.title,
        newBook.author,
        newBook.isbn,
        newBook.rating,
        newBook.notes,
        newBook.date_read,
      ],
    );

    // res.status(201).json(newBook);
    // flash success with message and redirect to home
    req.flash("success", "Book was added to your library.");
    res.redirect("/")
  } catch (error) {
    // if there's an error, check if error.code is UNIQUE CONSTRAINT
    if (error.code === "23505") {
      // if yes, return and render new.ejs with the newBook values and an error for isbn field 
      return res.render("new.ejs", {
        book: newBook,
        errors: { isbn: "This book is already on your library." },
      });
    }
    // other error, log the error, flash error and message and redirect to books/new
    console.error(error);
    req.flash("error", "Something went wrong. Please try again in a moment.")
    res.redirect("/books/new");
  }
});

// GET /books/:id - to view a single book
app.get("/books/:id", async (req, res) => {
  // convert id from req to int
  const id = parseInt(req.params.id);
  try {
    // db query to select the book where id matches
    const result = await db.query("SELECT * FROM books WHERE id = $1", [id]);
    const book = result.rows[0];

    // if book does not exist
    if (!book) {
      // flash error and message
      req.flash("error", "This book no longer exists.");
      // redirecct to /
      return res.redirect("/");
    }

    // check if book has a cover
    const hasCover = await coverExists(book.isbn);

    // render show.ejs with book and value of hasCover
    res.render("show.ejs", { book, hasCover });
  } catch (error) {
    // if there's an error, log error, flash error and message, and redirect to /
    console.error(error);
    req.flash("error", "Something went wrong. Please try again in a moment.")
    res.redirect("/");
  }
});
// GET /books/:id/edit - render the edit page with the book values
app.get("/books/:id/edit", async (req, res) => {
  // convert id from req to int
  const id = parseInt(req.params.id);
  try {
    // db query to select the book where id matches
    const result = await db.query("SELECT * FROM books WHERE id = $1", [id]);
    const book = result.rows[0];

    // if book does not exist, silenty redirect to /
    if (!book) {
      return res.redirect("/");
    }

    // res.json(book);
    // render edit.ejs with the values of the book
    res.render("edit.ejs", { book });
  } catch (error) {
    // if there's an error, log error, flash error and message, and redirect to /
    console.error(error);
    req.flash("error", "Something went wrong. Please try again in a moment.");
    res.redirect("/");
  }
});

// POST /books/:id - update book
app.post("/books/:id", async (req, res) => {
  // convert id from req to int
  const id = parseInt(req.params.id);
  // build updatedBook with new values
  const updatedBook = {
    title: req.body.title,
    author: req.body.author,
    isbn: req.body.isbn ? req.body.isbn.replace(/-/g, "").toUpperCase() : null,
    rating: parseInt(req.body.rating),
    notes: req.body.notes,
    date_read: req.body.date_read,
  }

  // validate updatedBook
  const errors = validateBook(updatedBook);

  // check if there are errors 
  if (Object.keys(errors).length > 0) {
    // if yes, render the edit.ejs with book (including id) and the errors
    return res.render("edit.ejs", { book: { ...updatedBook, id }, errors });
  }

  try {
    // db query to update the values of a book where id matches
    const result = await db.query("UPDATE books SET title = $1, author = $2, isbn = $3, rating = $4, notes = $5, date_read = $6 WHERE id = $7", 
      [
        updatedBook.title,
        updatedBook.author,
        updatedBook.isbn,
        updatedBook.rating,
        updatedBook.notes,
        updatedBook.date_read, 
        id, 
      ]);

      // checks if there's no book updated (rowcCount === 0), book does not exist
    if (result.rowCount === 0) {
      // if yes, redirect to /
      return res.redirect("/");
    }

    // res.status(200).json(updatedBook);
    // flash success message and redirect to /
    req.flash("success", "Changes to your book notes were saved.");
    res.redirect("/");
  } catch (error) {
    // if there's an error, check if error.code is UNIQUE CONSTRAINT
    if (error.code === "23505") {
      // if yes, return and render new.ejs with the newBook values and an error for isbn field 
      return res.render("edit.ejs", {
        book: { ...updatedBook, id },
        errors: { isbn: "This book is already on your library." },
      });
    }
    // other error, log the error, flash error and message and redirect to books/id/edit
    console.error(error);
    req.flash("error", "Something went wrong updating this book. Please try again in a moment.");
    res.redirect(`/books/${id}/edit`);
  }
});

// POST /books/:id/delete - delete a book
app.post("/books/:id/delete", async (req, res) => {
  // convert id to integer
  const id = parseInt(req.params.id);
  try {
    // db querty to delete the book that matches id
    const result = await db.query("DELETE FROM books WHERE id = $1", [ id ]);

    // checks if book does not exist
    if (result.rowCount === 0) {
      // if yes, redirect to /
      return res.redirect("/");
    }

    // flash success message and redirect to /
    req.flash("success", "Book was deleted from your library.");
    res.redirect("/");
  } catch (error) {
    // if there's an error, log error, flash error message and redirect to /
    console.error(error);
    req.flash("error", "Couldn't delete this book. Please try again.")
    res.redirect("/");
  }
});

// Catch-all for any request that doesn't match a defined route (e.g. /nonexistent)
app.use((req, res) => res.status(404).send("Page not found"));

// Last-resort error handler — catches anything that slips past individual route try/catch blocks.
// Must have exactly 4 params (err, req, res, next) — this signature is how Express
// identifies it as an error handler specifically, not normal middleware.
app.use((err, req, res, next) => {
  console.error(err);
  req.flash("error", "Something went wrong. Please try again.");
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
