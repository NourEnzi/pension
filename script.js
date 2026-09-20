// متغير عالمي لحفظ نسخة المخطط البياني لتحديثه بدلاً من تكرار رسمه
window.myDoughnutChart = null;

/* ==========================================================================
   القسم الأول: التهيئة وربط أحداث الواجهة (Initialization & Event Listeners)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    populateDateDropdowns();
    bindEvents();
    setupServiceWorker();
    setupSecurityFeatures();
}

function populateDateDropdowns() {
    const currentYear = new Date().getFullYear(); 
    const bMonth = document.getElementById("birthMonth");
    const aMonth = document.getElementById("appointmentMonth");
    const bYearSelect = document.getElementById("birthYear");
    const aYearSelect = document.getElementById("appointmentYear");
    
    for (let m = 1; m <= 12; m++) { 
        bMonth.add(new Option(m, m)); 
        aMonth.add(new Option(m, m)); 
    }
    
    for (let y = currentYear - 15; y >= 1950; y--) { 
        bYearSelect.add(new Option(y, y)); 
    }
    
    for (let y = currentYear; y >= currentYear - 70; y--) { 
        aYearSelect.add(new Option(y, y)); 
    }
}

function bindEvents() {
    document.getElementById("calculate-btn").addEventListener("click", handleCalculateClick);
    document.getElementById("print-btn").addEventListener("click", () => window.print());
    document.getElementById("toggleDetailsBtn").addEventListener("click", togglePensionDetails);
    
    const autoCalcFields = ["birthMonth", "birthYear", "appointmentMonth", "appointmentYear", "targetInput"];
    autoCalcFields.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener(el.tagName === "INPUT" ? "input" : "change", calculateExpectedContributions);
    });

    document.getElementById("darkModeToggle").addEventListener("click", toggleDarkMode);

    document.querySelectorAll(".accordion-btn").forEach(acc => {
        acc.addEventListener("click", function() {
            this.classList.toggle("active");
            const content = this.nextElementSibling;
            content.style.maxHeight = content.style.maxHeight ? null : content.scrollHeight + "px";
        });
    });

    setupInstallPrompt();
}

function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    let icon = document.getElementById("darkModeToggle").querySelector("i");
    const isDark = document.body.classList.contains("dark-mode");
    
    if(isDark) {
        icon.classList.replace("fa-moon", "fa-sun");
        icon.style.color = "#f1c40f"; 
    } else {
        icon.classList.replace("fa-sun", "fa-moon");
        icon.style.color = ""; 
    }

    // تحديث ألوان الرسم البياني فوراً عند تغيير الوضع
    if (window.myDoughnutChart) {
        window.myDoughnutChart.options.plugins.legend.labels.color = isDark ? '#48c9b0' : '#117864';
        window.myDoughnutChart.data.datasets[0].borderColor = isDark ? '#0b2e27' : '#e8f8f5';
        window.myDoughnutChart.update();
    }
}

/* ==========================================================================
   القسم الثاني: المدخلات والتحقق (Input Extraction & Validation)
   ========================================================================== */

function getInputs() {
    return {
        gender: document.getElementById("gender").value,
        birthYear: document.getElementById("birthYear").value,
        birthMonth: document.getElementById("birthMonth").value,
        appYear: document.getElementById("appointmentYear").value,
        appMonth: document.getElementById("appointmentMonth").value,
        targetInput: parseInt(document.getElementById("targetInput").value),
        cont: parseInt(document.getElementById("expectedCont").value),
        salary: parseFloat(document.getElementById("avgSalary").value) || 0,
        isHazardous: document.getElementById("isHazardous").checked
    };
}

function validateInputs(inputs) {
    if(!inputs.birthYear || !inputs.targetInput || isNaN(inputs.cont) || inputs.salary < 0) {
        alert("عذراً، يرجى تعبئة الحقول الأساسية وتجنب القيم السالبة في الراتب.");
        return false;
    }
    
    let bY = parseInt(inputs.birthYear);
    let currentRefYear = inputs.targetInput <= 120 ? bY + inputs.targetInput : inputs.targetInput;
    let currentAge = currentRefYear - bY;
    
    if(currentRefYear <= bY || currentAge <= 0 || currentAge > 120 || 
      (inputs.targetInput > 120 && inputs.targetInput < 2024) || 
      (inputs.appYear && (currentRefYear < parseInt(inputs.appYear) || parseInt(inputs.appYear) - bY < 16))) {
        alert("بيانات غير قانونية أو غير منطقية: يرجى التحقق من التواريخ.");
        return false;
    }

    return { ...inputs, bY, currentRefYear, currentAge };
}

function calculateExpectedContributions() {
    const inputs = getInputs();
    let c = document.getElementById("expectedCont");
    
    if(inputs.birthYear && inputs.birthMonth && inputs.targetInput){
        let y = parseInt(inputs.birthYear);
        let targetYear = inputs.targetInput <= 100 ? y + inputs.targetInput : inputs.targetInput; 
        if(inputs.appYear && inputs.appMonth){
            let appY = parseInt(inputs.appYear);
            let appM = parseInt(inputs.appMonth);
            let bM = parseInt(inputs.birthMonth);
            let months = (targetYear - appY) * 12 + (bM - appM);
            c.value = months > 0 ? months : 0;
            c.readOnly = true;
            c.style.backgroundColor = "var(--info-header-bg)";
        } else {
            let ageAtTarget = targetYear - y;
            let yearsOfWork = ageAtTarget - 22;
            c.value = yearsOfWork > 0 ? yearsOfWork * 12 : 0;
            c.readOnly = false;
            c.style.backgroundColor = "";
        }
    } else {
        c.readOnly = false;
        c.style.backgroundColor = "";
    }
}

/* ==========================================================================
   القسم الثالث: المحرك الحسابي (Core Business Logic)
   ========================================================================== */

function processRulesAndMath(validInputs) {
    const { gender, currentAge, currentRefYear, cont, salary, isHazardous } = validInputs;
    
    const oldRules = {
        earlyGenCont: gender === "male" ? 252 : 228,
        earlySpecCont: gender === "male" ? 300 : 264,
        mandatoryCont: 180,
        mandatoryAge: gender === "male" ? 60 : 55,
        earlyHazardAge: 45
    };

    let newRules = { ...oldRules, earlyHazardAge: 50, earlyHazardCont: 300 };
    
    if(currentRefYear >= 2030) {
        let factor = currentRefYear - 2030 + 1;
        newRules.earlyGenCont += (6 * factor);
        if(gender === "male" && newRules.earlyGenCont > 360) newRules.earlyGenCont = 360;
        if(gender === "female" && newRules.earlyGenCont > 300) newRules.earlyGenCont = 300;
        
        newRules.mandatoryCont += (6 * factor);
        if(newRules.mandatoryCont > 240) newRules.mandatoryCont = 240;
        
        let maxAge = gender === "male" ? 65 : 60;
        newRules.mandatoryAge += (0.5 * factor);
        if(newRules.mandatoryAge > maxAge) newRules.mandatoryAge = maxAge;
    }

    let pensionData = null;
    if (salary > 0 && cont > 0) {
        const MAX_INSURABLE = 3733;
        let effectiveSalary = Math.min(salary, MAX_INSURABLE);
        let yearsOfService = cont / 12;
        let basePension = (effectiveSalary <= 1500) 
            ? effectiveSalary * (yearsOfService * 0.025) 
            : (1500 * (yearsOfService * 0.025)) + ((effectiveSalary - 1500) * (yearsOfService * 0.020));
        
        let allocationIncrease = basePension < 500 ? 40 : 20;
        let pensionAfterIncrease = basePension + allocationIncrease;
        
        let earlyDiscountRate = 0;
        let earlyDiscountAmount = 0;
        
        if (currentAge < newRules.mandatoryAge) {
            if (!isHazardous) {
                let monthsEarly = (newRules.mandatoryAge - currentAge) * 12;
                earlyDiscountRate = Math.floor(monthsEarly / 6) * 0.02;
                if (earlyDiscountRate > 0) earlyDiscountAmount = pensionAfterIncrease * earlyDiscountRate;
            }
        }
        
        let finalPension = Math.max(pensionAfterIncrease - earlyDiscountAmount, 200);
        
        pensionData = {
            basePension, allocationIncrease, earlyDiscountRate, 
            earlyDiscountAmount, finalPension, isCapped: salary > MAX_INSURABLE
        };
    }

    let lumpSumData = null;
    if (salary > 0 && cont > 0) {
        let lumpSumBase = salary * cont * 0.2175;
        let multiplier = cont >= 216 ? 1.15 : (cont >= 120 ? 1.12 : 1.1);
        lumpSumData = {
            total: (lumpSumBase * multiplier).toFixed(2),
            incrementText: cont >= 216 ? "15%" : (cont >= 120 ? "12%" : "10%")
        };
    }

    return { validInputs, oldRules, newRules, pensionData, lumpSumData };
}

/* ==========================================================================
   القسم الرابع: الرسم البياني وتحديث واجهة المستخدم (UI Rendering & Charts)
   ========================================================================== */

function handleCalculateClick() {
    const validInputs = validateInputs(getInputs());
    if(!validInputs) return;

    const results = processRulesAndMath(validInputs);
    renderResultsUI(results);
}

function renderResultsUI(results) {
    const { validInputs, oldRules, newRules, pensionData, lumpSumData } = results;
    const { currentRefYear, currentAge, cont, salary, isHazardous } = validInputs;

    document.getElementById("resYear").innerText = currentRefYear;
    document.getElementById("resAge").innerText = currentAge;
    document.getElementById("resCont").innerText = cont;

    renderEligibilityBoxes(currentAge, cont, oldRules, newRules, isHazardous);
    renderPensionBox(pensionData, isHazardous, cont, currentAge, newRules.mandatoryAge);
    drawPensionChart(pensionData, isHazardous, currentAge, newRules.mandatoryAge);
    renderLumpSumBox(lumpSumData, salary, cont);
    
    document.getElementById("resultBox").style.display = "block";
    updateWhatsAppShareLink(currentAge, cont);
}

function renderEligibilityBoxes(currentAge, cont, oldRules, newRules, isHazardous) {
    const oldEarlyBox = document.getElementById("oldEarlyBox");
    const newEarlyBox = document.getElementById("newEarlyBox");
    
    if (isHazardous) {
        let metOldHazard = (currentAge >= oldRules.earlyHazardAge && cont >= oldRules.earlySpecCont);
        oldEarlyBox.className = metOldHazard ? "status-box success" : "status-box fail";
        oldEarlyBox.innerHTML = metOldHazard 
            ? `✅ <strong>التقاعد المبكر (مهن خطرة): مستوفى الشروط</strong><br>وفقاً لقانون 2014 الساري، تم استيفاء شرط العمر (${oldRules.earlyHazardAge}) ورصيد الاشتراكات (${oldRules.earlySpecCont}).`
            : `❌ <strong>التقاعد المبكر (مهن خطرة): غير مستوفى الشروط</strong><br>الحد الأدنى المطلوب: عمر ${oldRules.earlyHazardAge} واشتراكات ${oldRules.earlySpecCont} وفقاً لقانون 2014 الساري.`;

        let metNewHazard = (currentAge >= newRules.earlyHazardAge && cont >= newRules.earlyHazardCont);
        newEarlyBox.className = metNewHazard ? "status-box success" : "status-box fail";
        newEarlyBox.innerHTML = generateOutputHTML("التقاعد المبكر (مهن خطرة)", metNewHazard, newRules.earlyHazardAge, newRules.earlyHazardCont, false, true);
    } else {
        let metOldGen = (currentAge >= 50 && cont >= oldRules.earlyGenCont);
        oldEarlyBox.className = metOldGen ? "status-box success" : "status-box fail";
        oldEarlyBox.innerHTML = metOldGen
            ? `✅ <strong>التقاعد المبكر: مستوفى الشروط</strong><br>تم استيفاء شرط العمر (50) ورصيد الاشتراكات (${oldRules.earlyGenCont}).`
            : `❌ <strong>التقاعد المبكر: غير مستوفى الشروط</strong><br>الحد الأدنى المطلوب: عمر 50 واشتراكات ${oldRules.earlyGenCont}.`;
        
        let metNewGen = (currentAge >= 50 && cont >= newRules.earlyGenCont);
        newEarlyBox.className = metNewGen ? "status-box success" : "status-box fail";
        newEarlyBox.innerHTML = generateOutputHTML("التقاعد المبكر", metNewGen, 50, newRules.earlyGenCont, metNewGen);
    }
    
    const oldMandBox = document.getElementById("oldMandatoryBox");
    oldMandBox.className = (currentAge >= oldRules.mandatoryAge && cont >= oldRules.mandatoryCont) ? "status-box success" : "status-box fail";
    oldMandBox.innerHTML = generateOutputHTML("تقاعد الشيخوخة الوجوبي", currentAge >= oldRules.mandatoryAge && cont >= oldRules.mandatoryCont, oldRules.mandatoryAge, oldRules.mandatoryCont);
    
    const newMandBox = document.getElementById("newMandatoryBox");
    newMandBox.className = (currentAge >= newRules.mandatoryAge && cont >= newRules.mandatoryCont) ? "status-box success" : "status-box fail";
    newMandBox.innerHTML = generateOutputHTML("تقاعد الشيخوخة الوجوبي", currentAge >= newRules.mandatoryAge && cont >= newRules.mandatoryCont, newRules.mandatoryAge, newRules.mandatoryCont);
}

function generateOutputHTML(title, isMet, ageReq, contReq, hasDiscount = false, isHazardRule = false) {
    let html = isMet 
        ? `✅ <strong>${title}: مستوفى الشروط</strong><br>تم استيفاء شرط العمر (${ageReq}) ورصيد الاشتراكات (${contReq}).`
        : `❌ <strong>${title}: غير مستوفى الشروط</strong><br>الحد الأدنى المطلوب: عمر ${ageReq} واشتراكات ${contReq}.`;
        
    if(isHazardRule) {
        html += "<br><span class='hazard-note'>⚠️ تذكير: يُشترط أن يتضمن رصيدك 120 اشتراكاً فعلياً في المهن الخطرة.</span>";
    } else if(hasDiscount && isMet) {
        html += "<span class='discount-note'>⚠️ ملاحظة قانونية: يخضع راتب التقاعد المبكر لنسبة تخفيض (خصم) مقدارها 2% عن كل 6 أشهر تسبق سن التقاعد الوجوبي. (تم تطبيقها في صندوق الراتب أدناه)</span>";
    }
    return html;
}

function renderPensionBox(pensionData, isHazardous, cont, currentAge, newMandatoryAge) {
    const box = document.getElementById("pensionCalcBox");
    if(!pensionData) {
        box.style.display = "none";
        return;
    }

    document.getElementById("pensionResult").innerText = pensionData.finalPension.toFixed(2) + " دينار أردني شهرياً";
    document.getElementById("detBasic").innerText = pensionData.basePension.toFixed(2);
    document.getElementById("detIncrease").innerText = pensionData.allocationIncrease.toFixed(2);
    
    const discountRow = document.getElementById("detDiscountRow");
    const hazardNoteRow = document.getElementById("hazardDetNoteRow");
    
    if (pensionData.earlyDiscountRate > 0 && !isHazardous) {
        discountRow.style.display = "flex";
        hazardNoteRow.style.display = "none";
        document.getElementById("detDiscountRate").innerText = (pensionData.earlyDiscountRate * 100).toFixed(0);
        document.getElementById("detDiscount").innerText = "-" + pensionData.earlyDiscountAmount.toFixed(2);
    } else if (isHazardous && currentAge < newMandatoryAge) {
        discountRow.style.display = "none";
        hazardNoteRow.style.display = "block";
    } else {
        discountRow.style.display = "none";
        hazardNoteRow.style.display = "none";
    }
    
    document.getElementById("detFinal").innerText = pensionData.finalPension.toFixed(2);
    
    document.getElementById("pensionDetailsExpanded").style.display = "none";
    document.getElementById("toggleDetailsBtn").innerText = "عرض تفاصيل الحسبة";

    let detailText = `* تم تقدير الراتب بناءً على اشتراكات (${cont} شهراً)، مع دمج معاملات المنفعة الجديدة، زيادة التخصيص الثابتة، والحد الأدنى 200 دينار.`;
    if (pensionData.isCapped) detailText += " (تنبيه: تم تخفيض الراتب المدخل إلى سقف الخضوع 3733 ديناراً).";
    document.getElementById("pensionDetails").innerText = detailText;
    
    box.style.display = "block";
}

// دالة رسم المخطط الدائري التفاعلي
function drawPensionChart(pensionData, isHazardous, currentAge, newMandatoryAge) {
    const chartContainer = document.getElementById('chartContainer');
    if (!pensionData) {
        chartContainer.style.display = 'none';
        return;
    }
    
    chartContainer.style.display = 'block';
    const ctx = document.getElementById('pensionChart').getContext('2d');

    if (window.myDoughnutChart) {
        window.myDoughnutChart.destroy();
    }

    let labels = [];
    let data = [];
    let bgColors = [];

    // المنطق: إذا كان هناك خصم مبكر، نعرض "الراتب الصافي" مقابل "الخصم المقتطع"
    if (pensionData.earlyDiscountAmount > 0 && !isHazardous && currentAge < newMandatoryAge) {
        labels = ['الراتب الصافي (بعد الخصم)', 'قيمة الخصم المقتطعة'];
        data = [pensionData.finalPension, pensionData.earlyDiscountAmount];
        bgColors = ['#27ae60', '#e74c3c']; // أخضر وأحمر
    } else {
        // إذا تقاعد وجوبي أو مهن خطرة (لا نعرض خصم هنا)، نظهر "الراتب الأساسي" و"زيادة التخصيص"
        labels = ['الراتب الأساسي', 'زيادة التخصيص'];
        data = [pensionData.basePension, pensionData.allocationIncrease];
        bgColors = ['#27ae60', '#3498db']; // أخضر وأزرق
    }

    const isDark = document.body.classList.contains('dark-mode');

    window.myDoughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderWidth: 2,
                borderColor: isDark ? '#0b2e27' : '#e8f8f5' // متطابق مع لون صندوق الراتب
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%', // تفريغ منتصف الدائرة
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: "'Cairo', sans-serif", size: 14, weight: 'bold' },
                        color: isDark ? '#48c9b0' : '#117864'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ' ' + context.label + ': ' + context.parsed.toFixed(2) + ' دينار';
                        }
                    },
                    titleFont: { family: "'Cairo', sans-serif" },
                    bodyFont: { family: "'Cairo', sans-serif", size: 14 }
                }
            }
        }
    });
}

function renderLumpSumBox(lumpSumData, salary, cont) {
    if(lumpSumData) {
        document.getElementById("lumpSumResult").innerText = lumpSumData.total + " دينار أردني";
        document.getElementById("lumpSumDetails").innerText = `* تم الحساب التقديري بناءً على متوسط الراتب (${salary})، واشتراكات (${cont} شهراً)، بإضافة زيادة قانونية نسبتها ${lumpSumData.incrementText} وفقاً لمسودة التعديلات.`;
    } else {
        document.getElementById("lumpSumResult").innerText = "يرجى إدخال متوسط الراتب لحساب التكلفة التقديرية";
        document.getElementById("lumpSumDetails").innerText = "";
    }
}

function togglePensionDetails() {
    let detailsDiv = document.getElementById("pensionDetailsExpanded");
    let btn = document.getElementById("toggleDetailsBtn");
    if (detailsDiv.style.display === "none" || detailsDiv.style.display === "") {
        detailsDiv.style.display = "block";
        btn.innerText = "إخفاء تفاصيل الحسبة";
    } else {
        detailsDiv.style.display = "none";
        btn.innerText = "عرض تفاصيل الحسبة";
    }
}

function updateWhatsAppShareLink(resAge, resCont) {
    let oldEarlyStatus = document.getElementById("oldEarlyBox").innerHTML.includes("مستوفى الشروط") && !document.getElementById("oldEarlyBox").innerHTML.includes("غير مستوفى") ? "✅ أستوفي الشروط" : "❌ لا أستوفي الشروط";
    let oldMandStatus = document.getElementById("oldMandatoryBox").innerHTML.includes("مستوفى الشروط") && !document.getElementById("oldMandatoryBox").innerHTML.includes("غير مستوفى") ? "✅ أستوفي الشروط" : "❌ لا أستوفي الشروط";
    let newEarlyStatus = document.getElementById("newEarlyBox").innerHTML.includes("مستوفى الشروط") && !document.getElementById("newEarlyBox").innerHTML.includes("غير مستوفى") ? "✅ أستوفي الشروط" : "❌ لا أستوفي الشروط";
    let newMandStatus = document.getElementById("newMandatoryBox").innerHTML.includes("مستوفى الشروط") && !document.getElementById("newMandatoryBox").innerHTML.includes("غير مستوفى") ? "✅ أستوفي الشروط" : "❌ لا أستوفي الشروط";

    let msg = `مرحباً! استخدمت حاسبة التقاعد التجريبية للضمان الاجتماعي 🇯🇴 (v3.5.0).\n\nتخطيطي للتقاعد على عمر (${resAge}) عاماً، بإجمالي اشتراكات (${resCont}) شهراً.\n\n⚖️ *حسب قانون 2014 الساري:*\n▪️ التقاعد المبكر: ${oldEarlyStatus}\n▪️ تقاعد الشيخوخة الوجوبي: ${oldMandStatus}\n\n⚖️ *حسب التعديلات المقترحة:*\n▪️ التقاعد المبكر: ${newEarlyStatus}\n▪️ تقاعد الشيخوخة الوجوبي: ${newMandStatus}\n\nجرب الأداة وقارن وضعك التقاعدي بنفسك من هنا:\nhttps://nourenzi.github.io/pension/`;
    let waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    
    document.getElementById("whatsapp-share-btn").href = waUrl;
    document.getElementById("floating-wa-btn").href = waUrl;
}

/* ==========================================================================
   القسم الخامس: الحماية وإدارة التطبيق (Security & PWA)
   ========================================================================== */

function setupSecurityFeatures() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.onkeydown = function(e) {
        if(e.keyCode == 123) return false; 
        if(e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74 || e.keyCode == 67)) return false; 
        if(e.ctrlKey && e.keyCode == 85) return false; 
    };
}

let deferredPrompt;
function setupInstallPrompt() {
    const installAppBtn = document.getElementById('installAppBtn');
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); 
        deferredPrompt = e; 
    });

    installAppBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt(); 
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
        } else {
            alert("📥 لتنزيل التطبيق على هاتفك بسرعة:\n\n🍎 لأجهزة آيفون (Safari): اضغط على زر 'المشاركة' في أسفل الشاشة، ثم اختر 'إضافة إلى الشاشة الرئيسية'.\n\n🤖 لأجهزة أندرويد (Chrome): اضغط على النقاط الثلاث في أعلى المتصفح، ثم اختر 'تثبيت التطبيق'.");
        }
    });

    window.addEventListener('appinstalled', () => {
        installAppBtn.style.display = 'none';
        deferredPrompt = null;
    });
}

function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
            .catch((error) => console.log('فشل تسجيل عامل الخدمة:', error));
        });
    }
}