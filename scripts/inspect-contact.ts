import * as XLSX from 'xlsx';

const f = 'C:/Users/Admin/.gemini/antigravity/brain/21a9997d-edd4-4d21-b227-1fc51eec1345/.user_uploaded/media_1793615696479_9f77d0fc.xlsx';
const wb = XLSX.readFile(f);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);
console.log('Total contacts in raw sheet:', data.length);
console.log('Sample contact 0:', data[0]);
console.log('Sample contact 1:', data[1]);
