const TEMPO_MS = 180;
const BEAT_COUNT = 16;

const playBtn = document.querySelector(".play");
const stopBtn = document.querySelector(".stop");
const importFileInput = document.getElementById("importFile");
const clearBtn = document.querySelector(".btn.clear");

playBtn.addEventListener("click", play);
stopBtn.addEventListener("click", stop);
clearBtn.addEventListener("click", clearPattern);
importFileInput.addEventListener("change", e => {
  if (e.target.files[0]) importPattern(e.target.files[0]);
});
document.addEventListener("keydown", e => {
  if (e.code === "Space") {
    e.preventDefault();
    loopInterval ? stop() : play();
  }
});

const instruments = [
  { name: "tom", audioId: "tAudio", btnClass: ".tom-btn", padClass: ".tom" },
  { name: "clap", audioId: "cAudio", btnClass: ".clap-btn", padClass: ".clap" },
  { name: "boom", audioId: "bAudio", btnClass: ".boom-btn", padClass: ".boom" },
  { name: "ride", audioId: "rAudio", btnClass: ".ride-btn", padClass: ".ride" },
  { name: "closedhat", audioId: "chAudio", btnClass: ".closedhat-btn", padClass: ".closedhat" },
  { name: "openhat", audioId: "oAudio", btnClass: ".openhat-btn", padClass: ".openhat" },
  { name: "snare", audioId: "sAudio", btnClass: ".snare-btn", padClass: ".snare" },
  { name: "kick", audioId: "kAudio", btnClass: ".kick-btn", padClass: ".kick" },
];

let isMouseDown = false;
let isErasing = false;

document.addEventListener('mousedown', e => {
  isMouseDown = true;
  // Detect if we're starting on an active square to allow erasing
  if (e.target.classList.contains("square") && e.target.classList.contains("active")) {
    isErasing = true;
  } else {
    isErasing = false;
  }
});
document.addEventListener('mouseup', () => {
  isMouseDown = false;
});


const audioMap = {};
const padMap = {};

instruments.forEach(inst => {
  audioMap[inst.name] = document.getElementById(inst.audioId);
  padMap[inst.name] = document.querySelectorAll(inst.padClass);

  // Title play buttons
  document.querySelector(inst.btnClass).addEventListener("click", () => playSound(inst.name));

  // Pad interactions
  padMap[inst.name].forEach(pad => {
    pad.addEventListener("click", () => pad.classList.toggle("active"));

    pad.addEventListener("mouseenter", () => {
      if (isMouseDown) {
        pad.classList.toggle("active", !isErasing); // Add or remove based on starting action
      }
    });
  });
});


let activeTimeouts = [];

//Plays the pads of a single instrument at the right times
function playARow(pads, timing, playSound) {
  pads.forEach((pad, i) => {
    //Plays each pad at timing * i moment of time
    const timeoutId1 = setTimeout(() => {
      pad.classList.add("active-square");
      if (pad.classList.contains("active")) playSound();

      const timeoutId2 = setTimeout(() => {
        pad.classList.remove("active-square");
      }, timing);

      activeTimeouts.push(timeoutId2);
    }, i * timing);

    activeTimeouts.push(timeoutId1);
  });
}

//Calls playARow for every row at the same time
function playAll() {
  instruments.forEach(inst => {
    playARow(padMap[inst.name], TEMPO_MS, () => playSound(inst.name));
  });
}

let loopInterval = null;
//Loops the beat by playing it between an interval TEMPO_MS * BEAT_COUNT
function play() {
  if (loopInterval) return;
  playAll(); 
  loopInterval = setInterval(playAll, TEMPO_MS * BEAT_COUNT);
  playBtn.style.display = "none";
  stopBtn.style.display = "block";
}

//Play the sound of an instrument
function playSound(name) {
  const audio = audioMap[name];
  if (!audio) return;
  audio.currentTime = 0;
  audio.play();
}


function stop() {
  clearInterval(loopInterval);  
  loopInterval = null;

  // Clear all scheduled timeouts for highlights
  activeTimeouts.forEach(id => clearTimeout(id));
  activeTimeouts = [];

  // Also remove all highlight classes immediately
  instruments.forEach(inst => {
    padMap[inst.name].forEach(pad => {
      pad.classList.remove("active-square");
    });
  });

  stopBtn.style.display = "none";
  playBtn.style.display = "block";
}

function clearPattern() {
  instruments.forEach(inst => {
    padMap[inst.name].forEach(pad => {
      pad.classList.remove("active");
    });
  });
}

function getPattern(pads) {
  return Array.from(pads).map(pad => pad.classList.contains("active"));
}


function applyPattern(pads, pattern) {
  pads.forEach((pad, i) => {
    pad.classList.toggle("active", !!pattern[i]);
  });
}

function exportJSON() {
  const pattern = {};
  instruments.forEach(inst => {
    pattern[inst.name] = getPattern(padMap[inst.name]);
  });

  const blob = new Blob([JSON.stringify(pattern, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "beat-pattern.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importPattern(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const pattern = JSON.parse(e.target.result);
      instruments.forEach(inst => {
        if (Array.isArray(pattern[inst.name])) {
          applyPattern(padMap[inst.name], pattern[inst.name]);
        }
      });
      alert("Pattern imported successfully!");
    } catch (err) {
      alert("Invalid pattern file.");
    }
  };
  reader.readAsText(file);
}

async function exportAudio() {
  const context = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100 * 10, 44100); // 10 seconds max
  const beatDuration = TEMPO_MS / 1000; // seconds per beat
  const startTime = 0;
  let maxTime = 0;

  for (const inst of instruments) {
    const pattern = getPattern(padMap[inst.name]);
    const audio = audioMap[inst.name];
    const response = await fetch(audio.querySelector("source").src);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await context.decodeAudioData(arrayBuffer);

    pattern.forEach((isActive, i) => {
      if (!isActive) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const time = startTime + i * beatDuration;
      source.start(time);
      maxTime = Math.max(maxTime, time + buffer.duration);
    });
  }

  context.startRendering().then(renderedBuffer => {
    const wavBlob = bufferToWavBlob(renderedBuffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "beat.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }).catch(err => {
    alert("Error rendering audio: " + err);
  });
}

// Helper: convert AudioBuffer to WAV
function bufferToWavBlob(buffer) {
  const numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArray = new ArrayBuffer(length),
        view = new DataView(bufferArray),
        channels = [],
        sampleRate = buffer.sampleRate;
  let offset = 0;

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + buffer.length * numOfChan * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);  // Subchunk1Size (PCM)
  view.setUint16(20, 1, true);   // AudioFormat (PCM)
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChan * 2, true);
  view.setUint16(32, numOfChan * 2, true);
  view.setUint16(34, 16, true);  // Bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, buffer.length * numOfChan * 2, true);

  // Write interleaved audio samples
  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }

  offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}


const exportImageBtn = document.querySelector(".export-image");
exportImageBtn.addEventListener("click", exportImage);

function exportImage() {
  const target = document.querySelector(".card"); 

  html2canvas(target).then(canvas => {
    const link = document.createElement("a");
    link.download = `pattern-${new Date().toLocaleDateString("en-GB").replaceAll('/', '-')}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
}


const saveInHistoryBtn = document.querySelector(".save-in-history");

function saveInHistory() {
  const pattern = {};
  instruments.forEach(inst => {
    pattern[inst.name] = getPattern(padMap[inst.name]);
  });

  const data = {
    name: `pattern-${new Date().toLocaleDateString("en-GB").replaceAll('/','-')}`,
    pattern
  };

  fetch("saveInHistory.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      addToHistoryList(data.id, data.name);
      alert("Pattern saved to memory!");
    } else {
      alert("Error saving pattern.");
    }
  })
  .catch(err => {
    alert("Failed to save pattern.");
    console.error(err);
  });
}


function addToHistoryList(id, name) {
  const historyList = document.getElementById("historyList");

  const entry = document.createElement("div");
  entry.className = "history-entry";
  entry.textContent = `#${id} |  ${name}`;
  entry.dataset.id = id;
  entry.addEventListener("click", () => loadPatternFromDatabase(id));

  historyList.prepend(entry);
}

function loadPatternFromDatabase(id) {
  fetch(`loadPattern.php?id=${id}`)
    .then(res => res.json())
    .then(data => {
      if (data.success && data.pattern) {
        instruments.forEach(inst => {
          if (Array.isArray(data.pattern[inst.name])) {
            applyPattern(padMap[inst.name], data.pattern[inst.name]);
          }
        });
        alert(`Loaded pattern #${id}`);
      } else {
        alert("Pattern not found.");
      }
    })
    .catch(err => {
      alert("Failed to load pattern.");
      console.error(err);
    });
}

window.addEventListener("DOMContentLoaded", () => {
  fetch("loadHistory.php")
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        data.patterns.reverse().forEach(p => addToHistoryList(p.id, p.name));
      }
    })
    .catch(err => console.error("Failed to load history:", err));
});

