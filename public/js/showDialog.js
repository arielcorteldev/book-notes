const deleteDialog = document.getElementById("delete-dialog");
const openDeleteBtn = document.getElementById("open-delete-dialog");
const cancelDeleteBtn = document.getElementById("cancel-delete");

openDeleteBtn.addEventListener("click", () => deleteDialog.showModal());


cancelDeleteBtn.addEventListener("click", () => deleteDialog.close());