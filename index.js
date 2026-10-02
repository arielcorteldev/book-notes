import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import axios from 'axios';

const app = express();
const port = 3000;

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "book_notes",
    password: "cod34food",
    port: 5432,
})
db.connect();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.send("<h1>Book Notes</h1>");
})

app.get("/books/new", (req, res) => {
    res.send("<h1>Add book</h1>");
})

app.post("/books", (req, res) => {
    res.sendStatus(201);
})

app.get("/books/:id", (req, res) => {
    res.status(200);
})

app.get("/books/:id/edit", (req, res) => {
    res.status(200);
})

app.post("/books/:id", (req, res) => {
    res.status(201);
})

app.post("/books/:id/delete", (req, res) => {
    res.status(200);
})

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
})