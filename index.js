import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";

const app = express();
const port = 3000;

const { types } = pg;
types.setTypeParser(1082, (val) => val);

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "book_notes",
  password: "cod34food",
  port: 5432,
});
db.connect();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- Date validation ---
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

function isNotFuture(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // allow today, reject only strictly future dates
  return date <= today;
}

// --- ISBN validation ---
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

function isValidISBN13(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false; // all 13 must be digits

  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const weight = i % 2 === 0 ? 1 : 3;
    sum += parseInt(isbn[i]) * weight;
  }

  return sum % 10 === 0;
}

// --- Full book validation ---
function validateBook(book) {
  const errors = {};

  if (!book.title || book.title.trim() === "") {
    errors.title = "Enter the book title.";
  } else if (book.title.length > 200) {
    errors.title = "Title must be 200 characters or fewer.";
  }

  if (!book.author || book.author.trim() === "") {
    errors.author = "Enter the author's name.";
  } else if (book.author.length > 200) {
    errors.author = "Author must be 200 characters or fewer.";
  }

  if (!isValidISBN(book.isbn)) {
    errors.isbn = "This ISBN doesn't look valid - check for typos.";
  }

  if (isNaN(book.rating) || book.rating < 1 || book.rating > 5) {
    errors.rating = "Please select a rating between 1 and 5.";
  }

  if (!book.notes || book.notes.trim() === "") {
    errors.notes = "Add a summary note for this book.";
  } else if (book.notes.length > 1000) {
    errors.notes = "Notes can't exceed 1000 characters.";
  }

  if (!isValidDateRead(book.date_read)) {
    errors.date_read = "Please enter a valid date.";
  } else if (!isNotFuture(book.date_read)) {
    errors.date_read = "The date read can't be in the future.";
  }

  return errors;
}

async function coverExists(isbn) {
  if (!isbn) return false;

  try {
    await axios.get(
      `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`,
    );
    return true;
  } catch (error) {
    console.error("Cover check failed: ", error.message);
    return false;
  }
}

app.get("/", async (req, res) => {
  const sortOptions = {
    date_desc: { column: "date_read", direction: "DESC" },
    date_asc: { column: "date_read", direction: "ASC" },
    rating_desc: { column: "rating", direction: "DESC" },
    rating_asc: { column: "rating", direction: "ASC" },
  };
  const { column, direction } =
    sortOptions[req.query.sort] || sortOptions.date_desc;

  try {
    const result = await db.query(
      `SELECT * FROM books ORDER BY ${column} ${direction}`,
    );
    const books = result.rows;

    const booksWithCoverFlag = await Promise.all(
      books.map(async (book) => ({
        ...book,
        hasCover: await coverExists(book.isbn),
      })),
    );

    console.log(booksWithCoverFlag);

    res.json(booksWithCoverFlag);
    // res.render("index.ejs", { books: booksWithCoverFlag });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
});

app.get("/books/new", (req, res) => {
  res.send("<h1>Add Book</h1>");
  //    res.render("new.ejs");
});

app.post("/books", async (req, res) => {
  const newBook = {
    title: req.body.title,
    author: req.body.author,
    isbn: req.body.isbn ? req.body.isbn.replace(/-/g, "").toUpperCase() : null,
    rating: parseInt(req.body.rating),
    notes: req.body.notes,
    date_read: req.body.date_read,
  };

  const errors = validateBook(newBook);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  try {
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

    res.status(201).json(newBook);
    // res.redirect("/")
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "This book is already on your list.",
      });
    }
    console.error(error);
    res.status(500).json({
      message:
        "Something went wrong saving your book. Please try again in a moment.",
    });
  }
});

app.get("/books/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const result = await db.query("SELECT * FROM books WHERE id = $1", [id]);
    const book = result.rows[0];

    if (!book) {
      return res.status(404).json({
        message: "This book no longer exists.",
      });
    }

    const hasCover = await coverExists(book.isbn);

    res.json({ ...book, hasCover });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong. Please try again in a moment.",
    });
  }
});

app.get("/books/:id/edit", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const result = await db.query("SELECT * FROM books WHERE id = $1", [id]);
    const book = result.rows[0];

    if (!book) {
      return res.redirect("/");
    }

    res.json(book);
    // res.render("edit.ejs", {book});
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong. Please try again in a moment.",
    });
  }
});

app.post("/books/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const updatedBook = {
    title: req.body.title,
    author: req.body.author,
    isbn: req.body.isbn ? req.body.isbn.replace(/-/g, "").toUpperCase() : null,
    rating: parseInt(req.body.rating),
    notes: req.body.notes,
    date_read: req.body.date_read,
  }

  const errors = validateBook(updatedBook);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  try {
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

    if (result.rowCount === 0) {
      return res.redirect("/");
    }

    res.status(200).json(updatedBook);
    // res.redirect("/", { message: "Changes to your book notes were saved." })
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "This book is already on your list.",
      });
    }
    console.error(error);
    res.status(500).json({
      message:
        "Something went wrong updating this book. Please try again in a moment.",
    });
  }
});

app.post("/books/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const result = await db.query("DELETE FROM books WHERE id = $1", [ id ]);

    if (result.rowCount === 0) {
      return res.redirect("/");
    }

    res.status(200).json({
      message: "Book deleted."
    })

    // res.redirect("/", { message: "Book was deleted from your library." })
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Couldn't delete this book. Please try again."
    })
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
