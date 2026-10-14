const cancelDialog = document.getElementById("cancel-dialog");
const openCancelBtn = document.getElementById("open-cancel-dialog");
const stayBtn = document.getElementById("stay-btn");
const bookForm = document.getElementById("book-form");
const notesInput = document.getElementById("notes");
const notesCount = document.getElementById("notes-count");
const dateReadInput = document.getElementById("date-read");
const backLink = document.getElementById("back-link");

const cancelDestination = openCancelBtn.dataset.cancelHref;

const fieldIds = ["title", "author", "date-read", "isbn", "notes"];
let formChanged = fieldIds.some((id) => document.getElementById(id).value !== "") || bookForm.querySelector('input[name="rating"]:checked') !== null;

bookForm.querySelectorAll("input, textarea").forEach((el) => {
    el.addEventListener("input", () => { formChanged = true; });
});

openCancelBtn.addEventListener("click", () => {
    if (formChanged) {
        cancelDialog.showModal();
    } else {
        window.location.href = cancelDestination;
    }
});

backLink.addEventListener("click", (e) => {
    if (formChanged) {
        e.preventDefault();
        cancelDialog.showModal();
    }
})

stayBtn.addEventListener("click", () => cancelDialog.close());

function updateNotesCount() {
    notesCount.textContent = `${notesInput.value.length} / 1000`;
}

updateNotesCount();
notesInput.addEventListener("input", updateNotesCount);

dateReadInput.max = new Date().toLocaleDateString("en-CA");