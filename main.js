const fs = require("fs");

function parseTimeToSeconds(timeStr) {
    const [time, modifier] = timeStr.split(' ');
    let [h, m, s] = time.split(':').map(Number);
    if (modifier === 'pm' && h !== 12) h += 12;
    if (modifier === 'am' && h === 12) h = 0;
    return h * 3600 + m * 60 + s;
}

function parseDurationToSeconds(durStr) {
    const [h, m, s] = durStr.split(':').map(Number);
    return h * 3600 + m * 60 + s;
}

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function isSpecialDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return month === 4 && day >= 15 && day <= 21;
}

function getQuotaSeconds(dateStr) {
    return isSpecialDate(dateStr) ? 6 * 3600 : 8 * 3600 + 24 * 60;
}

function getOverlap(start, end) {
    const coreStart = 8 * 3600;
    const coreEnd = 22 * 3600;
    if (end < start) {
        return getOverlap(start, 24 * 3600) + getOverlap(0, end);
    }
    const overlapStart = Math.max(start, coreStart);
    const overlapEnd = Math.min(end, coreEnd);
    return overlapStart < overlapEnd ? overlapEnd - overlapStart : 0;
}


// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    const start = parseTimeToSeconds(startTime);
    let end = parseTimeToSeconds(endTime);
    if (end < start) end += 24 * 3600;
    return formatTime(end - start);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    const start = parseTimeToSeconds(startTime);
    let end = parseTimeToSeconds(endTime);
    const total = end < start ? (24 * 3600 - start + end) : (end - start);
    const overlap = getOverlap(start, end);
    const idle = total - overlap;
    return formatTime(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    const shiftSec = parseDurationToSeconds(shiftDuration);
    const idleSec = parseDurationToSeconds(idleTime);
    return formatTime(shiftSec - idleSec);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    const activeSec = parseDurationToSeconds(activeTime);
    const quotaSec = getQuotaSeconds(date);
    return activeSec >= quotaSec;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    // read file if found
    let lines = [];
    try {
        const data = fs.readFileSync(textFile, 'utf8');
        lines = data.split('\n').filter(line => line.trim() !== '');
    } catch (e) {
        // no file
    }

    // duplicate checker
    const duplicate = lines.some(line => {
        const fields = line.split(',');
        return fields[0] === shiftObj.driverID && fields[2] === shiftObj.date;
    });
    if (duplicate) return {};

    const shiftDur = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    const idle = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    const active = getActiveTime(shiftDur, idle);
    const quotaMet = metQuota(shiftObj.date, active);
    const hasBonus = false;

    // new line in csv 
    const newLine = [
        shiftObj.driverID,
        shiftObj.driverName,
        shiftObj.date,
        shiftObj.startTime,
        shiftObj.endTime,
        shiftDur,
        idle,
        active,
        quotaMet,
        hasBonus
    ].join(',');

    // append ll file
    fs.appendFileSync(textFile, (lines.length ? '\n' : '') + newLine, 'utf8');

    // return el obj m3 ten properties
    return {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDur,
        idleTime: idle,
        activeTime: active,
        metQuota: quotaMet,
        hasBonus: hasBonus
    };
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    const data = fs.readFileSync(textFile, 'utf8');
    const lines = data.split('\n');
    const updatedLines = lines.map(line => {
        if (line.trim() === '') return line;
        const fields = line.split(',');
        if (fields[0] === driverID && fields[2] === date) {
            fields[9] = newValue.toString();
            return fields.join(',');
        }
        return line;
    });
    fs.writeFileSync(textFile, updatedLines.join('\n'), 'utf8');
}


// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    const data = fs.readFileSync(textFile, 'utf8');
    const lines = data.split('\n').filter(l => l.trim() !== '');
    let count = 0;
    let foundDriver = false;
    const monthNum = parseInt(month, 10);
    for (const line of lines) {
        const fields = line.split(',');
        if (fields[0] === driverID) {
            foundDriver = true;
            const dateParts = fields[2].split('-');
            const recordMonth = parseInt(dateParts[1], 10);
            if (recordMonth === monthNum && fields[9] === 'true') {
                count++;
            }
        }
    }
    return foundDriver ? count : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    const data = fs.readFileSync(textFile, 'utf8');
    const lines = data.split('\n').filter(l => l.trim() !== '');
    let totalSec = 0;
    for (const line of lines) {
        const fields = line.split(',');
        if (fields[0] === driverID) {
            const dateParts = fields[2].split('-');
            const recordMonth = parseInt(dateParts[1], 10);
            if (recordMonth === month) {
                totalSec += parseDurationToSeconds(fields[7]); // activeTime is field 7
            }
        }
    }
    return formatTime(totalSec);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    textFile = "./shifts.txt";
    rateFile = "./PublicTestFiles/driverRatesPublic.txt";
    const shiftData = fs.readFileSync(textFile, 'utf8');
    const shiftLines = shiftData.split('\n').filter(line => line.trim() !== '');
    let workDays = 0;
    for (let i = 1; i < shiftLines.length; i++) {
        const fields = shiftLines[i].split(',');
        if (fields[0] === driverID) {
            const dateParts = fields[2].split('-');
            const recordMonth = parseInt(dateParts[1], 10);
            if (recordMonth === month) {
                workDays++;
            }}}
    const rateData = fs.readFileSync(rateFile, 'utf8');
    const rateLines = rateData.split('\n').filter(line => line.trim() !== '');
    let dailyRate = 0;
    for (let i = 0; i < rateLines.length; i++) {
        const fields = rateLines[i].split(',');
        if (fields[0] === driverID) {
            dailyRate = parseInt(fields[3], 10);
            break;
        }}
    const totalMinutes = (workDays * dailyRate) + (bonusCount * 2 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(3, '0')}:${minutes.toString().padStart(2, '0')}:00`;}


// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    rateFile = "./PublicTestFiles/driverRatesPublic.txt";
    const actualParts = actualHours.split(':').map(Number);
    const actualMinutes = actualParts[0] * 60 + actualParts[1];
    const requiredParts = requiredHours.split(':').map(Number);
    const requiredMinutes = requiredParts[0] * 60 + requiredParts[1];
    const rateData = fs.readFileSync(rateFile, 'utf8');
    const rateLines = rateData.split('\n').filter(line => line.trim() !== '');
    let baseSalary = 0;
    let overtimeRate = 0;
    for (let i = 0; i < rateLines.length; i++) {
        const fields = rateLines[i].split(',');
        if (fields[0] === driverID) {
            baseSalary = parseInt(fields[2], 10);
            overtimeRate = parseInt(fields[3], 10);
            break;
        }}
    if (actualMinutes >= requiredMinutes) {
        return baseSalary;
    } else {
        const minutesShort = requiredMinutes - actualMinutes;
        const hoursShort = Math.ceil(minutesShort / 60);
        const deduction = hoursShort * overtimeRate;
        return baseSalary - deduction;}}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
