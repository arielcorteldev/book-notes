# Book Notes

A personal library for the books you've read. Log each book with your rating, the date you finished it, and a short summary of its key takeaways, then browse and sort your collection later. Book covers are fetched automatically from the Open Library Covers API.

Built as a capstone project for Dr. Angela Yu's web development bootcamp. The idea comes from Derek Sivers' [book notes page](https://sive.rs/book).

## Features

- **Create, read, update, and delete** books, persisted in a PostgreSQL database
- **Book covers** fetched from the Open Library Covers API using each book's ISBN, with a local placeholder when no cover is available
- **Sorting** by date read (newest or oldest first) and by rating (highest or lowest first)
- **Star ratings** from 1 to 5, displayed on every book card
- **Server-side validation** with inline error messages that keep everything you typed
- **ISBN validation** that accepts ISBN-10 and ISBN-13 (hyphens allowed) and verifies the checksum
- **Flash notifications** for success and error messages, with a slide-in animation
- **Confirmation dialogs** before deleting a book and before discarding unsaved changes
- **Responsive layout**, designed mobile-first
- **Accessibility** touches: labelled form controls, `aria-invalid` and `aria-describedby` on errors, keyboard-friendly star rating, and reduced-motion support

## Tech Stack

- **Server:** Node.js, Express
- **Database:** PostgreSQL, accessed with [`pg`](https://www.npmjs.com/package/pg)
- **Templating:** EJS
- **External API:** [Open Library Covers API](https://openlibrary.org/dev/docs/api/covers), called with Axios
- **Frontend:** HTML, CSS, and vanilla JavaScript
- **Sessions:** `express-session`, used for flash messages

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (a current LTS version)
- [PostgreSQL](https://www.postgresql.org/) installed and running locally
- [nodemon](https://www.npmjs.com/package/nodemon) (optional, for auto-restart during development)

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd <repository-folder>
```

### 2. Install dependencies

```bash
npm i
```

### 3. Create the database

Create a database for the app, then run the schema file against it:

```bash
psql -U postgres -c "CREATE DATABASE book_notes;"
psql -U postgres -d book_notes -f schema.sql
```

You can use a different database name as long as it matches `DB_NAME` in the next step.

### 4. Configure environment variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

| Variable         | Description                                         |
| ---------------- | --------------------------------------------------- |
| `DB_USER`        | PostgreSQL user                                     |
| `DB_HOST`        | Database host (usually `localhost`)                 |
| `DB_NAME`        | Database name (for example `book_notes`)            |
| `DB_PASSWORD`    | PostgreSQL password                                 |
| `DB_PORT`        | Database port (PostgreSQL default is `5432`)        |
| `SESSION_SECRET` | Any long, random string used to sign session cookies |

The `.env` file is ignored by Git, so your credentials are never committed.

### 5. Start the server

```bash
nodemon index.js
```

Or, without nodemon:

```bash
node index.js
```

Then open [http://localhost:3000](http://localhost:3000).

## Database Schema

The app uses a single table, `books`:

```sql
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    author VARCHAR(200) NOT NULL,
    isbn VARCHAR(13) UNIQUE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    notes VARCHAR(1000) NOT NULL,
    date_read DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

A few design choices worth knowing:

- `isbn` is optional but unique, and is stored without hyphens. It is a string and not a number so that leading zeros and the `X` check digit of ISBN-10 are preserved.
- `date_read` is a plain `DATE`, so sorting by "recency" reflects when you read the book and not when you entered it.
- The single-table design needs no relationships, since the app has one user and one kind of record.

## Routes

| Method | Path               | Description                                              |
| ------ | ------------------ | -------------------------------------------------------- |
| GET    | `/`                | Home page: list of all books, with optional `?sort=`     |
| GET    | `/books/new`       | Add book form                                            |
| POST   | `/books`           | Create a book                                            |
| GET    | `/books/:id`       | View a single book                                       |
| GET    | `/books/:id/edit`  | Edit book form, pre-filled                               |
| POST   | `/books/:id`       | Update a book                                            |
| POST   | `/books/:id/delete`| Delete a book                                            |

Valid `sort` values are `date_desc` (default), `date_asc`, `rating_desc`, and `rating_asc`. Updates and deletes use `POST` because plain HTML forms can only send `GET` and `POST`.

## Error Handling

- **Validation errors** re-render the form with the submitted values and an inline message under each invalid field.
- **Duplicate ISBNs** are caught from the database's unique constraint and reported on the ISBN field.
- **Open Library failures** (no cover, timeout, or the service being down) never block saving a book. The app logs the error on the server and shows a placeholder image instead.
- **Database errors** show a friendly flash message, and the details are logged to the server console.
- A catch-all handler covers unknown routes, and a last-resort error handler covers anything unexpected.

## Project Structure

```
.
├── index.js            # Express app: routes, validation, database access
├── schema.sql          # Database table definition
├── .env.example        # Template for required environment variables
├── views/
│   ├── index.ejs       # Home page (list, sorting, empty state)
│   ├── new.ejs         # Add book form
│   ├── edit.ejs        # Edit book form
│   ├── show.ejs        # Single book page with delete confirmation
│   └── partials/
│       ├── head.ejs    # Shared <head> markup
│       ├── flash.ejs   # Success and error notifications
│       └── star.ejs    # Single star icon, reused for ratings
└── public/
    ├── styles/         # main.css and tokens.css (design tokens)
    ├── js/             # Small client-side scripts, one per page
    └── images/         # Placeholder cover image
```

## Credits

- Idea inspired by [Derek Sivers' book notes](https://sive.rs/book)
- Project brief from Dr. Angela Yu's web development bootcamp
- Book covers courtesy of the [Open Library Covers API](https://openlibrary.org/dev/docs/api/covers)