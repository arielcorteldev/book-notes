const sortBtn = document.getElementById("sort-btn");
const sortDropdown = document.getElementById("sort-dropdown");

function setOpen(open) {
    sortBtn.setAttribute("aria-expanded", String(open));
    sortDropdown.hidden = !open;
}

sortBtn.addEventListener("click", () => {
    setOpen(sortBtn.getAttribute("aria-expanded") !== "true");
})

document.addEventListener("click", (e) => {
    if (!sortBtn.contains(e.target) && !sortDropdown.contains(e.target)) {
        setOpen(false);
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !sortDropdown.hidden) {
        setOpen(false);
        sortBtn.focus();
    }
})