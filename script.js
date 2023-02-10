let formLogin = document.getElementById("form-login");
let formRegister = document.getElementById("form-register");

document.getElementById("register-link").addEventListener("click", function(event) {
  event.preventDefault();
  formLogin.style.display = "none";
  formRegister.style.display = "block";
});

document.getElementById("login-link").addEventListener("click", function(event) {
  event.preventDefault();
  formLogin.style.display = "block";
  formRegister.style.display = "none";
});
