let slideIndexes = {};

function plusSlides(n, sliderId) {
  if (!slideIndexes[sliderId]) slideIndexes[sliderId] = 1;
  showSlides(slideIndexes[sliderId] += n, sliderId);
}

function currentSlide(n, sliderId) {
  if (!slideIndexes[sliderId]) slideIndexes[sliderId] = 1;
  showSlides(slideIndexes[sliderId] = n, sliderId);
}

function showSlides(n, sliderId) {
  let i;
  let slider = document.getElementById(sliderId);
  let slides = slider.getElementsByClassName("mySlides");
  let dots = slider.parentElement.getElementsByClassName("dot");

  if (n > slides.length) slideIndexes[sliderId] = 1;
  if (n < 1) slideIndexes[sliderId] = slides.length;

  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";  
  }
  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
  }

  slides[slideIndexes[sliderId] - 1].style.display = "block";  
  dots[slideIndexes[sliderId] - 1].className += " active";
}

// Inicializace každého slideru
document.querySelectorAll('.slideshow-container').forEach(slider => {
  let sliderId = slider.id;
  slideIndexes[sliderId] = 1;
  showSlides(1, sliderId);
});
