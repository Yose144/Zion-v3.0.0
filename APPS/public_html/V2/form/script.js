document.getElementById('orderForm').addEventListener('submit', function(event) {
    let isValid = true;

    // Validace jména
    const name = document.getElementById('name').value;
    if (name.trim() === '') {
        document.getElementById('nameError').textContent = 'Jméno je povinné.';
        isValid = false;
    } else {
        document.getElementById('nameError').textContent = '';
    }

    // Validace e-mailu
    const email = document.getElementById('email').value;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        document.getElementById('emailError').textContent = 'Neplatná e-mailová adresa.';
        isValid = false;
    } else {
        document.getElementById('emailError').textContent = '';
    }

    // Validace telefonu
    const phone = document.getElementById('phone').value;
    if (phone.trim() !== '' && !/^\d+$/.test(phone)) {
        document.getElementById('phoneError').textContent = 'Telefonní číslo musí obsahovat pouze číslice.';
        isValid = false;
    } else {
        document.getElementById('phoneError').textContent = '';
    }

    // Validace adresy
    const address = document.getElementById('address').value;
    if (address.trim() === '') {
        document.getElementById('addressError').textContent = 'Adresa je povinná.';
        isValid = false;
    } else {
        document.getElementById('addressError').textContent = '';
    }

    // Validace produktu
    const product = document.getElementById('product').value;
    if (product === '') {
        document.getElementById('productError').textContent = 'Vyberte produkt.';
        isValid = false;
    } else {
        document.getElementById('productError').textContent = '';
    }

    // Validace množství
    const quantity = document.getElementById('quantity').value;
    if (quantity <= 0) {
        document.getElementById('quantityError').textContent = 'Množství musí být kladné číslo.';
        isValid = false;
    } else {
        document.getElementById('quantityError').textContent = '';
    }

    if (!isValid) {
        event.preventDefault();
    }
});