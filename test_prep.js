const fs = require('fs');

function normalizeText(str) {
    return str
        .toLocaleUpperCase('tr-TR')
        .replace(/['’]/g, '')
        .replace(/[^A-Z0-9ÇĞİIÖŞÜ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const transcriptText = fs.readFileSync('C:\\Users\\Elif\\.gemini\\antigravity\\brain\\231de0bb-e502-4eeb-8f22-c4b4b4f57ae3\\scratch\\transcript_text.txt', 'utf8');
const cleanText = normalizeText(transcriptText);

const headerRegex = /(\d{4})\s+(\d{4})\s+(GÜZ|BAHAR|YAZ)/g;
const semestersInTranscript = [];
let match;
while ((match = headerRegex.exec(cleanText)) !== null) {
    semestersInTranscript.push({
        text: match[0],
        index: match.index,
        yearStart: parseInt(match[1]),
        yearEnd: parseInt(match[2]),
        type: match[3],
        isPrep: false
    });
}

for (let i = 0; i < semestersInTranscript.length; i++) {
    const start = semestersInTranscript[i].index;
    const end = (i + 1 < semestersInTranscript.length) ? semestersInTranscript[i + 1].index : cleanText.length;
    const semContent = cleanText.substring(start, end);
    if (semContent.includes('ARAPÇA HAZIRLIK') || semContent.includes('PREPARATORY ARABIC')) {
        semestersInTranscript[i].isPrep = true;
    }
    console.log(`Semester: ${semestersInTranscript[i].text} | isPrep: ${semestersInTranscript[i].isPrep}`);
}
