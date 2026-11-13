import * as XLSX from 'xlsx';

const f = 'C:/Users/Admin/.gemini/antigravity/brain/21a9997d-edd4-4d21-b227-1fc51eec1345/.user_uploaded/media_1793615696487_7577cf9c.xls';
const wb = XLSX.readFile(f);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);
console.log('Total bills in raw SAP ALV:', data.length);
console.log('Sample bill 0:', data[0]);
console.log('Sample bill 1:', data[1]);
console.log('Sample bill 2:', data[2]);
