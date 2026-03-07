// ============================================================
// patch.js v2 - Financial Planner Pro Enhancements
// 1. Per-track projections table (rows=years, cols=tracks)
// 2. Enhanced report with integrated withdrawals
// ============================================================

console.log('✅ patch.js v2 loading...');

// ============================================================
// 1. Override renderProjections to also render per-track table
// ============================================================

const _origRenderProjections = renderProjections;

renderProjections = function() {
    _origRenderProjections();
    renderPerTrackProjections();
};

function renderPerTrackProjections() {
    const plan = getCurrentPlan();
    const years = parseInt(document.getElementById('projYears').value) || 20;
    const interval = parseInt(document.getElementById('projInterval')?.value) || 5;
    const currentYear = new Date().getFullYear();
    
    const headEl = document.getElementById('perTrackHead');
    const bodyEl = document.getElementById('perTrackBody');
    
    if (!headEl || !bodyEl) return;
    
    const activeInvs = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    
    if (activeInvs.length === 0) {
        headEl.innerHTML = '<tr><th>שנה</th><th>סה"כ</th></tr>';
        bodyEl.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #666; padding: 30px;">אין מסלולים להצגה</td></tr>';
        return;
    }
    
    // Header
    let headerHTML = '<tr><th style="position: sticky; right: 0; background: #3b82f6; z-index: 2;">שנה</th>';
    activeInvs.forEach(inv => {
        const shortName = inv.name.length > 15 ? inv.name.substring(0, 14) + '…' : inv.name;
        headerHTML += '<th title="' + inv.name + '">' + shortName + '</th>';
    });
    headerHTML += '<th style="background: #1e40af;">סה"כ</th></tr>';
    headEl.innerHTML = headerHTML;
    
    // Rows
    let rowsHTML = '';
    for (let y = 0; y <= years; y += interval) {
        const year = currentYear + y;
        let rowTotal = 0;
        const isFirst = y === 0;
        const bgStyle = isFirst ? ' style="background: rgba(59, 130, 246, 0.08);"' : '';
        
        rowsHTML += '<tr' + bgStyle + '>';
        rowsHTML += '<td style="font-weight: 600; position: sticky; right: 0; background: ' + (isFirst ? '#eef4ff' : '#fff') + '; z-index: 1;">' + year + '</td>';
        
        activeInvs.forEach(inv => {
            const value = calculateFV(inv.amount, inv.monthly, inv.returnRate, y,
                                     inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
            rowTotal += value;
            rowsHTML += '<td>' + formatCurrency(value) + '</td>';
        });
        
        rowsHTML += '<td style="font-weight: 700; color: var(--success, #10b981);">' + formatCurrency(rowTotal) + '</td>';
        rowsHTML += '</tr>';
    }
    
    bodyEl.innerHTML = rowsHTML;
}

// ============================================================
// 2. Updated generateReport with integrated withdrawals
// ============================================================

function generateReport() {
    const plan = getCurrentPlan();
    
    if (!plan || !plan.investments) {
        alert('שגיאה: לא נמצאה תוכנית או השקעות');
        return;
    }
    
    if (plan.investments.length === 0) {
        alert('⚠️ אין מסלולי השקעה להציג בדוח.\nאנא הוסף השקעות תחילה.');
        return;
    }
    
    const years = parseInt(document.getElementById('sumYears') && document.getElementById('sumYears').value) || 20;
    const interval = parseInt(document.getElementById('projInterval')?.value) || 5;
    const currentYear = new Date().getFullYear();
    
    const totalToday = plan.investments
        .filter(inv => inv.include && inv.type !== 'פנסיה')
        .reduce((sum, inv) => sum + (inv.amount || 0), 0);
    
    const projection = calculateProjectionWithWithdrawals(plan.investments, years, plan.withdrawals || []);
    
    const equityInvs = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    const totalAmount = equityInvs.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const avgFeeAnnual = totalAmount > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeAnnual || 0)), 0) / totalAmount : 0;
    const avgFeeDeposit = totalAmount > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.feeDeposit || 0)), 0) / totalAmount : 0;
    const avgReturn = totalAmount > 0 ? equityInvs.reduce((sum, inv) => sum + ((inv.amount || 0) * (inv.returnRate || 0)), 0) / totalAmount : 0;
    
    const totalReal = calculateRealValue(projection.finalNominal, years);
    
    const breakdown = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה').map(inv => {
        const nominal = calculateFV(inv.amount, inv.monthly, inv.returnRate, years, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
        const principal = calculatePrincipal(inv.amount, inv.monthly, years);
        return { name: inv.name, house: inv.house, today: inv.amount, monthly: inv.monthly, future: nominal, profit: nominal - principal };
    });
    
    // Active withdrawals
    const activeWithdrawals = (plan.withdrawals || []).filter(w => w.active !== false).sort((a, b) => a.year - b.year);
    const hasWithdrawals = activeWithdrawals.length > 0;
    
    // Build all years to show (interval + withdrawal years)
    const yearSet = new Set();
    for (let y = 0; y <= years; y += interval) {
        yearSet.add(currentYear + y);
    }
    activeWithdrawals.forEach(w => {
        if (w.year >= currentYear && w.year <= currentYear + years) {
            yearSet.add(w.year);
        }
    });
    const allYears = Array.from(yearSet).sort((a, b) => a - b);
    
    // Build projections rows
    let projectionsRows = '';
    allYears.forEach(year => {
        const y = year - currentYear;
        const proj = calculateProjectionWithWithdrawals(plan.investments, y, plan.withdrawals);
        const totalNominal = proj.finalNominal;
        const totalPrincipal = proj.finalPrincipal;
        const totalTax = calculateTax(totalPrincipal, totalNominal, 25, y);
        const real = calculateRealValue(totalNominal, y);
        const netAfterTax = totalNominal - totalTax;
        
        const yearWithdrawals = activeWithdrawals.filter(w => w.year === year);
        const withdrawalAmount = yearWithdrawals.reduce((sum, w) => sum + w.amount, 0);
        const withdrawalGoals = yearWithdrawals.map(w => w.goal).join(', ');
        const hasW = withdrawalAmount > 0;
        
        const rowStyle = hasW ? ' style="background: #fef2f2;"' : '';
        
        projectionsRows += '<tr' + rowStyle + '>';
        projectionsRows += '<td style="font-weight: 600;">' + year + '</td>';
        projectionsRows += '<td>' + formatCurrency(totalNominal) + '</td>';
        
        if (hasWithdrawals) {
            projectionsRows += '<td style="color: #ef4444; font-weight: ' + (hasW ? 'bold' : 'normal') + ';">' + (hasW ? formatCurrency(withdrawalAmount) : '-') + '</td>';
            projectionsRows += '<td style="font-size: 0.85em;">' + (withdrawalGoals || '-') + '</td>';
        }
        
        projectionsRows += '<td style="color: #3b82f6;">' + formatCurrency(real) + '</td>';
        projectionsRows += '<td style="color: #ef4444;">' + formatCurrency(totalTax) + '</td>';
        projectionsRows += '<td style="color: #10b981; font-weight: 600;">' + formatCurrency(netAfterTax) + '</td>';
        projectionsRows += '</tr>';
    });
    
    // Per-track table
    const activeInvs = plan.investments.filter(inv => inv.include && inv.type !== 'פנסיה');
    let perTrackHeader = '<th>שנה</th>';
    let perTrackRows = '';
    activeInvs.forEach(inv => { perTrackHeader += '<th>' + inv.name + '</th>'; });
    perTrackHeader += '<th style="background: #1e40af;">סה"כ</th>';
    
    for (let y = 0; y <= years; y += interval) {
        const year = currentYear + y;
        let rowTotal = 0;
        perTrackRows += '<tr><td style="font-weight: 600;">' + year + '</td>';
        activeInvs.forEach(inv => {
            const value = calculateFV(inv.amount, inv.monthly, inv.returnRate, y, inv.feeDeposit || 0, inv.feeAnnual || 0, inv.subTracks);
            rowTotal += value;
            perTrackRows += '<td>' + formatCurrency(value) + '</td>';
        });
        perTrackRows += '<td style="font-weight: 700; color: #10b981;">' + formatCurrency(rowTotal) + '</td></tr>';
    }
    
    // Build HTML
    const intervalLabel = interval === 1 ? 'שנה' : interval === 2 ? 'שנתיים' : interval + ' שנים';
    
    let html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>דוח פיננסי</title>';
    html += '<style>';
    html += 'body{font-family:Arial;padding:40px;background:#f9fafb}';
    html += '.container{max-width:1200px;margin:0 auto;background:white;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}';
    html += 'h1{color:#1f2937;font-size:2.5em;border-bottom:4px solid #3b82f6;padding-bottom:16px;margin-bottom:24px}';
    html += 'h2{color:#3b82f6;font-size:1.8em;margin:32px 0 16px;padding-right:12px;border-right:4px solid #3b82f6}';
    html += '.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:24px 0}';
    html += '.summary-card{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:20px;border-radius:12px}';
    html += '.summary-card-title{font-size:0.9em;opacity:0.9;margin-bottom:8px}.summary-card-value{font-size:1.8em;font-weight:bold}';
    html += 'table{width:100%;border-collapse:collapse;margin:20px 0;box-shadow:0 2px 8px rgba(0,0,0,0.1)}';
    html += 'th{background:#3b82f6;color:white;padding:14px;text-align:right;font-weight:600}';
    html += 'td{padding:12px 14px;border-bottom:1px solid #e5e7eb}tr:hover{background:#f3f4f6}';
    html += '.profit{color:#10b981;font-weight:bold}.table-scroll{overflow-x:auto;margin:20px 0}';
    html += '.print-btn{position:fixed;bottom:30px;left:30px;background:#3b82f6;color:white;border:none;padding:16px 24px;border-radius:12px;font-size:1.1em;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,0.4);z-index:1000}';
    html += '.print-btn:hover{background:#2563eb}@media print{.print-btn{display:none}}</style></head><body>';
    
    html += '<div class="container">';
    html += '<h1>📊 דוח פיננסי מסכם</h1>';
    html += '<p style="color:#6b7280;margin-bottom:32px">תוכנית: ' + plan.name + ' | תאריך: ' + new Date().toLocaleDateString('he-IL') + '</p>';
    
    html += '<h2>💰 מצב נוכחי</h2><div class="summary-grid">';
    html += '<div class="summary-card"><div class="summary-card-title">הון עצמי היום</div><div class="summary-card-value">' + formatCurrency(totalToday) + '</div></div>';
    html += '<div class="summary-card"><div class="summary-card-title">תחזית בעוד ' + years + ' שנים (נומינלי)</div><div class="summary-card-value">' + formatCurrency(projection.finalNominal) + '</div></div>';
    html += '<div class="summary-card"><div class="summary-card-title">תחזית (ריאלי - כוח קנייה)</div><div class="summary-card-value">' + formatCurrency(totalReal) + '</div></div>';
    html += '</div>';
    
    html += '<h2>📈 ממוצעים משוקללים</h2><div class="summary-grid">';
    html += '<div class="summary-card"><div class="summary-card-title">ממוצע תשואה שנתית</div><div class="summary-card-value">' + avgReturn.toFixed(2) + '%</div></div>';
    html += '<div class="summary-card"><div class="summary-card-title">ממוצע דמי ניהול - צבירה</div><div class="summary-card-value">' + avgFeeAnnual.toFixed(2) + '%</div></div>';
    html += '<div class="summary-card"><div class="summary-card-title">ממוצע דמי ניהול - הפקדה</div><div class="summary-card-value">' + avgFeeDeposit.toFixed(2) + '%</div></div>';
    html += '</div>';
    
    // Investment breakdown
    html += '<h2>📋 פירוט מסלולי השקעה</h2>';
    html += '<table><thead><tr><th>שם</th><th>בית השקעות</th><th>סכום היום</th><th>הפקדה חודשית</th><th>תחזית (' + years + ' שנים)</th><th>רווח צפוי</th></tr></thead><tbody>';
    breakdown.forEach(function(item) {
        html += '<tr><td><strong>' + item.name + '</strong></td><td>' + item.house + '</td><td>' + formatCurrency(item.today) + '</td><td>' + formatCurrency(item.monthly) + '/חודש</td><td>' + formatCurrency(item.future) + '</td><td class="profit">' + formatCurrency(item.profit) + '</td></tr>';
    });
    const totalMonthly = equityInvs.reduce(function(s, i) { return s + (i.monthly || 0); }, 0);
    html += '<tr style="background:#f3f4f6;font-weight:bold"><td colspan="2">סה"כ</td><td>' + formatCurrency(totalToday) + '</td><td>' + formatCurrency(totalMonthly) + '/חודש</td><td>' + formatCurrency(projection.finalNominal) + '</td><td class="profit">' + formatCurrency(projection.finalNominal - projection.finalPrincipal) + '</td></tr></tbody></table>';
    
    // Projections with withdrawals
    html += '<h2>📈 תחזית צמיחה (כל ' + intervalLabel + ')';
    if (hasWithdrawals) html += ' <span style="font-size: 0.6em; color: #f59e0b;">⚠️ כולל משיכות מתוכננות</span>';
    html += '</h2>';
    html += '<table><thead><tr><th>שנה</th><th>ערך נומינלי</th>';
    if (hasWithdrawals) html += '<th style="background:#dc2626;">משיכה</th><th style="background:#dc2626;">מטרה</th>';
    html += '<th>ערך ריאלי</th><th>מס במשיכה</th><th>נטו לאחר מס</th></tr></thead><tbody>';
    html += projectionsRows;
    html += '</tbody></table>';
    
    // Per-track table
    if (activeInvs.length > 1) {
        html += '<h2>📊 התקדמות לפי מסלול (כל ' + intervalLabel + ')</h2>';
        html += '<div class="table-scroll"><table><thead><tr>' + perTrackHeader + '</tr></thead><tbody>';
        html += perTrackRows;
        html += '</tbody></table></div>';
    }
    
    // Withdrawals summary
    if (hasWithdrawals) {
        const totalW = activeWithdrawals.reduce(function(s, w) { return s + w.amount; }, 0);
        html += '<h2>🗓️ סיכום משיכות מתוכננות</h2>';
        html += '<p style="margin-bottom:16px;color:#666;">סה"כ משיכות: <strong style="color:#ef4444;">' + formatCurrency(totalW) + '</strong></p>';
        html += '<table><thead><tr><th>שנה</th><th>מטרה</th><th>סכום</th><th>סטטוס</th></tr></thead><tbody>';
        activeWithdrawals.forEach(function(w) {
            html += '<tr><td><strong>' + w.year + '</strong></td><td>' + (w.goalId ? '🎯 ' : '') + w.goal + '</td><td style="color:#f59e0b;font-weight:bold">' + formatCurrency(w.amount) + '</td><td>' + (w.goalId ? 'מקושר ליעד' : 'משיכה ידנית') + '</td></tr>';
        });
        html += '</tbody></table>';
    }
    
    html += '<p style="margin-top:40px;padding-top:20px;border-top:2px solid #e5e7eb;color:#6b7280;text-align:center">נוצר באמצעות מתכנן פיננסי v40 | ' + new Date().toLocaleDateString('he-IL') + ' ' + new Date().toLocaleTimeString('he-IL') + '</p></div>';
    html += '<button class="print-btn" onclick="window.print()">🖨️ הדפס / שמור PDF</button></body></html>';
    
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(html);
    reportWindow.document.close();
}

console.log('✅ patch.js v2 loaded');
