document.querySelectorAll("dialog .close").forEach((button) => {
  button.type = "button";
  button.removeAttribute("value");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.closest("dialog").close("cancel");
  });
});
