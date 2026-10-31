// geting canvas by Boujjou Achraf
var c = document.getElementById("c");
var ctx = c.getContext("2d");

// loader elements
var loader = document.getElementById("matrixLoader");
var loaderBarFill = loader ? loader.querySelector(".loader-bar span") : null;
var loaderPercent = document.getElementById("loaderPercent");
var loaderProgress = 0;
var backgroundModeEnabled = false;
var backgroundPulseTimer = null;

function advanceLoader(amount) {
    if (!loader || backgroundModeEnabled) return;
    loaderProgress = Math.min(100, loaderProgress + amount);
    if (loaderBarFill) {
        loaderBarFill.style.width = loaderProgress + "%";
    }
    if (loaderPercent) {
        loaderPercent.textContent = Math.floor(loaderProgress) + "%";
    }
}

var fakeUploadInterval = loader ? setInterval(function () {
    advanceLoader(Math.random() * 8 + 3);
    if (loaderProgress >= 100) {
        clearInterval(fakeUploadInterval);
        finalizeLoader();
    }
}, 150) : null;

function finalizeLoader() {
    if (!loader || backgroundModeEnabled) return;
    if (loaderBarFill) loaderBarFill.style.width = "100%";
    if (loaderPercent) loaderPercent.textContent = "100%";
    setTimeout(function () {
        enterBackgroundMode();
    }, 400);
}

function enterBackgroundMode() {
    if (!loader || backgroundModeEnabled) return;
    backgroundModeEnabled = true;
    loader.classList.add("background-mode");
    startBackgroundPulse();
}

function startBackgroundPulse() {
    if (backgroundPulseTimer || !loaderBarFill) return;
    var width = 98;
    var direction = -1;
    backgroundPulseTimer = setInterval(function () {
        width += direction * 0.25;
        if (width <= 72 || width >= 100) {
            direction *= -1;
            width = Math.max(72, Math.min(100, width));
        }
        loaderBarFill.style.width = width + "%";
        if (loaderPercent) {
            loaderPercent.textContent = Math.floor(width) + "%";
        }
    }, 220);
}

window.addEventListener("load", function () {
    advanceLoader(100);
    if (fakeUploadInterval) clearInterval(fakeUploadInterval);
    finalizeLoader();
});

//making the canvas full screen
c.height = window.innerHeight;
c.width = window.innerWidth;

//chinese characters - taken from the unicode charset
var matrix = "abcdefghijklmnopqrstuvwxyz∞†ΩABCDEFGHIJKLMNOPQRSTUVWXYZ123456789§¢#€¡¶•ªº–≠‘“πø^¨¥†®´∑œåß∂ƒ@#$%∞^˙∆˚¬…æ«÷≥≤µ~∫√ç≈Ω&*()*∞&^%+-/~{[|`]}";
//converting the string into an array of single characters
matrix = matrix.split("");

var font_size = 12;
var columns = c.width/font_size; //number of columns for the rain

// --- přidané: upravitelné parametry rychlosti ---
var speed = 0.5;           // kolik "řádků" se posune drop za snímek (zvýš = rychleji)
var frameInterval = 66;    // ms mezi snímky (zmenšit = plynulejší/rychlejší)
// --- konec přidaného ---

//an array of drops - one per column
var drops = [];
for(var x = 0; x < columns; x++)
    drops[x] = 1; 

//drawing the characters
function draw()
{
    //Black BG for the canvas
    //translucent BG to show trail
    ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
    ctx.fillRect(0, 0, c.width, c.height);

    // nastavení fontu a základní barvy
    ctx.font = font_size + "px monospace";

    //looping over drops
    for(var i = 0; i < drops.length; i++)
    {
        // náhodný znak pro aktuální pozici
        var text = matrix[Math.floor(Math.random()*matrix.length)];
        var x = i * font_size;
        var y = drops[i] * font_size;

        // vykreslení normálního (tmavšího) zeleného znaku
        ctx.fillStyle = "#00cc00"; // základní zelená
        ctx.fillText(text, x, y);

        // vykreslení světlejší "hlavičky" příslušného sloupce nad aktuálním znakem
        var headY = y - font_size;
        if (headY >= 0) {
          var headChar = matrix[Math.floor(Math.random()*matrix.length)];
          // méně intenzivní, jemnější zelená (s nižší průhledností)
          ctx.fillStyle = "rgba(120,200,120,0.7)"; 
          ctx.fillText(headChar, x, headY);
        }

        // reset dropu když dosáhne dolu
        if(drops[i]*font_size > c.height && Math.random() > 0.975)
            drops[i] = 0;

        // místo drops[i]++ použijeme konfigurovatelnou rychlost:
        drops[i] += speed;
    }
}

// místo původního setInterval(draw, 35);
setInterval(draw, frameInterval);
