const THERAPISTS = ["พี่ประจักษ์", "พี่ประสิทธิ", "พี่สามารถ", "พี่วินัย", "พี่ไพบูลย์", "พี่วาสนา", "พี่สมศิริ", "พี่สัญญา"];
const SLOTS = ["09.00 - 09.30 น.", "09.35 - 10.05 น.", "10.10 - 10.40 น.", "10.45 - 11.15 น.", "12.15 - 12.45 น.", "12.50 - 13.20 น.","13.25 - 13.55 น.", "14.00 - 14.30 น.", "14.35 - 15.05 น.", "15.05 - 15.35 น."];
const THERAPIST_PHOTOS = { "พี่ประจักษ์": "https://img2.pic.in.th/LINE_NOTE_260303_5.jpg", "พี่ประสิทธิ": "https://img5.pic.in.th/file/secure-sv1/LINE_NOTE_260303_2.jpg", "พี่สามารถ": "https://img5.pic.in.th/file/secure-sv1/LINE_NOTE_260303_6.jpg", "พี่วินัย": "https://img5.pic.in.th/file/secure-sv1/LINE_NOTE_260303_8.jpg", "พี่ไพบูลย์": "https://img5.pic.in.th/file/secure-sv1/LINE_NOTE_260303_4.jpg", "พี่วาสนา": "https://img2.pic.in.th/LINE_NOTE_260303_1.jpg", "พี่สมศิริ": "https://img2.pic.in.th/LINE_NOTE_260303_3.jpg", "พี่สัญญา": "https://img2.pic.in.th/LINE_NOTE_260303_7.jpg" };
const DEFAULT_PHOTO = "https://cdn-icons-png.flaticon.com/512/147/147144.png";

// ดึงค่า Config ปลอดภัยจาก Vercel Injection หรือถ้าหาไม่เจอให้ระบุค่าตรงนี้ (ใส่ค่า Supabase พี่ปุ้มลงไปได้เลย)
const SUPABASE_URL = window.env?.SUPABASE_URL || "https://xxxxxx.supabase.co";
const SUPABASE_KEY = window.env?.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxx";
const ADMIN_LIST = ["650900050", "650900222"]; 

let currentUser = null, isFirstLoad = true, refreshInterval = null, lastRes = null;

function supabaseFetch(endpoint, options = {}) {
  const headers = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", ...options.headers };
  return fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, { ...options, headers });
}

function preloadImages() {
  const promises = Object.values(THERAPIST_PHOTOS).map(url => new Promise((res) => { const img = new Image(); img.src = url; img.onload = res; img.onerror = res; }));
  return Promise.all(promises);
}

// เริ่มต้นหน้าเว็บแบบ Instant Speed
$(document).ready(function() {
  $('#disabledTherapists').select2({ placeholder: "เลือกหมอที่หยุด" });
  preloadImages().then(() => {
    $('body').addClass('loaded');
    $('#loginSection').removeClass('d-none');
    $('#loading').addClass('d-none');
  });
});

function toggleLoading(show) { $('#loading').toggleClass('d-none', !show); }

function handleLogin() {
  const empId = $('#empId').val().trim();
  if(!empId) return Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสพนักงาน', 'warning');
  toggleLoading(true);

  supabaseFetch(`users?emp_id=eq.${empId}&select=*`).then(r => r.json()).then(data => {
    toggleLoading(false);
    if (data.length === 0) return Swal.fire('ผิดพลาด', 'ไม่พบรหัสพนักงานในระบบ', 'error');
    
    const user = data[0];
    currentUser = { empId: user.emp_id, name: user.name, isAdmin: ADMIN_LIST.includes(user.emp_id) };
    
    $('#loginSection').addClass('d-none'); 
    $('#mainSection').removeClass('d-none'); 
    $('#userNameDisp').text(`คุณ ${currentUser.name}`);
    
    if(currentUser.isAdmin) {
      $('#adminPanel').removeClass('d-none');
      const sel = $('#disabledTherapists').empty();
      THERAPISTS.forEach(t => sel.append(new Option(t, t)));
      
      supabaseFetch('settings?id=eq.1&select=*').then(r => r.json()).then(sett => {
        if(sett.length > 0) {
          $('#sysToggle').val(sett[0].status);
          $('#adminActiveDate').val(sett[0].active_date);
          $('#disabledTherapists').val(sett[0].disabled_therapists ? sett[0].disabled_therapists.split(',') : []).trigger('change');
        }
      });
    }
    loadTable(); 
    refreshInterval = setInterval(loadTable, 5000); // วิ่งลื่นไหล ไม่ดึงสคริปค้าง
  }).catch(() => { toggleLoading(false); Swal.fire('ผิดพลาด', 'เชื่อมต่อฐานข้อมูลล้มเหลว', 'error'); });
}

function handleLogout() { clearInterval(refreshInterval); currentUser = null; isFirstLoad = true; $('#empId').val(''); $('#mainSection').addClass('d-none'); $('#loginSection').removeClass('d-none'); $('#adminPanel').addClass('d-none'); }

function loadTable() {
  if(isFirstLoad) toggleLoading(true);
  
  Promise.all([
    supabaseFetch('settings?id=eq.1&select=*').then(r => r.json()),
    supabaseFetch('bookings?select=*').then(r => r.json())
  ]).then(([sett, books]) => {
    const settings = sett[0];
    const activeDate = settings.active_date;
    const bookedMap = {};
    const checkInMap = {};
    
    books.filter(b => b.date === activeDate).forEach(b => {
      const key = `${b.slot}|${b.therapist}`;
      bookedMap[key] = { name: b.emp_name, empId: b.emp_id };
      if (b.check_in_status) checkInMap[key] = b.check_in_status;
    });

    const res = {
      therapists: THERAPISTS, slots: SLOTS, booked: bookedMap, targetDate: activeDate,
      systemStatus: settings.status, checkInStatus: checkInMap,
      disabledTherapists: settings.disabled_therapists ? settings.disabled_therapists.split(',') : []
    };
    
    renderTable(res);
    if(isFirstLoad) { toggleLoading(false); isFirstLoad = false; }
  });
}

function renderTable(res) {
  lastRes = res;
  $('#closedMessage').toggleClass('d-none', res.systemStatus !== "CLOSED");
  const head = $('#tableHead'), body = $('#bookingBody');
  
  head.html(`<tr><th class="time-col">เวลา</th>${res.therapists.map(t => {
    const isDisabled = res.disabledTherapists.includes(t);
    return `<th class="therapist-header" style="${isDisabled ? 'opacity: 0.4' : ''}"><img src="${THERAPIST_PHOTOS[t] || DEFAULT_PHOTO}" class="therapist-img" loading="eager"><br>${t}${isDisabled ? '<br><small class="text-danger">(หยุด)</small>' : ''}</th>`;
  }).join('')}</tr>`);
  
  body.html(res.slots.map(s => `<tr><td class="time-col">${s}</td>${res.therapists.map(t => {
    const key = `${s}|${t}`, booking = res.booked[key], isMine = (booking && booking.name === currentUser.name), isDisabled = res.disabledTherapists.includes(t), adminAction = currentUser.isAdmin ? `onclick="book('${s}', '${t}', '${res.targetDate}')"` : "";
    
    if (booking) {
      const status = res.checkInStatus[key]; let checkInUI = '';
      if (currentUser.isAdmin) {
        if (status === 'มา') checkInUI = `<div class="mt-1 fw-bold text-success" style="font-size:0.8rem">✅ มาแล้ว</div>`;
        else if (status === 'ไม่มา') checkInUI = `<div class="mt-1 fw-bold text-danger" style="font-size:0.8rem">❌ ไม่มา</div>`;
        else checkInUI = `<div class="mt-1"><button class="btn btn-success btn-sm px-1 py-0" style="font-size:0.6rem" onclick="adminCheckIn('${s}','${t}','มา')">มา</button> <button class="btn btn-danger btn-sm px-1 py-0" style="font-size:0.6rem" onclick="adminCheckIn('${s}','${t}','ไม่มา')">ไม่มา</button></div>`;
      }
      return `<td><div class="slot-container"><button class="btn btn-slot ${isMine ? 'btn-my-booking' : 'btn-booked'}" ${adminAction} ${!currentUser.isAdmin ? 'disabled' : ''}><b>${isMine ? 'คิวของคุณ' : 'จองแล้ว'}</b><br><small>(${booking.name})</small></button>${(isMine || currentUser.isAdmin) ? `<div class="cancel-btn mt-1" onclick="confirmCancel('${s}', '${t}', '${res.targetDate}', '${booking.empId}', '${booking.name}')">ยกเลิก</div>` : ''}${checkInUI}</div></td>`;
    }
    const isClosed = (res.systemStatus === "CLOSED" && !currentUser.isAdmin), canBook = !isDisabled && !isClosed;
    return `<td><button onclick="book('${s}', '${t}', '${res.targetDate}')" class="btn btn-slot btn-available" ${!canBook ? 'disabled style="opacity:0.5"' : ''}>${isDisabled ? "หมอหยุด" : (isClosed ? "ปิดรับจอง" : "ว่าง")}</button></td>`;
  }).join('')}</tr>`).join(''));
}

function book(slot, therapist, date) {
  const adminTarget = $('#adminTargetEmp').val().trim();
  if (currentUser.isAdmin && adminTarget) {
    toggleLoading(true);
    supabaseFetch(`users?emp_id=eq.${adminTarget}`).then(r => r.json()).then(u => {
      if(u.length === 0) { toggleLoading(false); return Swal.fire('Error', 'ไม่พบรหัสพนักงาน', 'error'); }
      supabaseFetch(`bookings?date=eq.${date}&emp_id=eq.${adminTarget}`).then(r => r.json()).then(checkArr => {
         if(checkArr.length > 0) { toggleLoading(false); return Swal.fire('แจ้งเตือน', 'สิทธิ์เต็ม/ซ้ำ', 'warning'); }
         const payload = { date, slot, therapist, emp_id: u[0].emp_id, emp_name: u[0].name };
         supabaseFetch('bookings', { method: 'POST', body: JSON.stringify(payload) }).then(() => {
            supabaseFetch('booking_logs', { method: 'POST', body: JSON.stringify({...payload, action: 'BOOK_BY_ADMIN'}) });
            toggleLoading(false); $('#adminTargetEmp').val(''); loadTable(); Swal.fire('สำเร็จ', 'เรียบร้อย', 'success');
         });
      });
    });
    return;
  }

  Swal.fire({ title: 'ยืนยันจองคิว', html: `จอง <b>${therapist}</b> รอบ ${slot}`, showCancelButton: true, confirmButtonColor: '#FF8C00' }).then((result) => {
    if (result.isConfirmed) {
      toggleLoading(true);
      supabaseFetch(`bookings?date=eq.${date}&emp_id=eq.${currentUser.empId}`).then(r => r.json()).then(checkArr => {
        if(checkArr.length > 0) { toggleLoading(false); return Swal.fire('แจ้งเตือน', 'คุณใช้สิทธิ์ไปแล้วในรอบนี้', 'warning'); }
        
        const payload = { date, slot, therapist, emp_id: currentUser.empId, emp_name: currentUser.name };
        supabaseFetch('bookings', { method: 'POST', body: JSON.stringify(payload) }).then(res => {
          toggleLoading(false);
          if(!res.ok) { return Swal.fire('เสียใจด้วย', 'คิวนี้ถูกคนอื่นจองตัดหน้าไปแล้ว!', 'error'); }
          supabaseFetch('booking_logs', { method: 'POST', body: JSON.stringify({...payload, action: 'BOOK'}) });
          Swal.fire({ icon: 'success', title: 'สำเร็จ!', timer: 1500 }); loadTable();
        });
      });
    }
  });
}

function confirmCancel(slot, therapist, date, targetEmpId, targetEmpName) {
  Swal.fire({ title: 'ยกเลิกการจอง?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545' }).then((result) => {
    if (result.isConfirmed) {
      toggleLoading(true);
      supabaseFetch(`bookings?date=eq.${date}&slot=eq.${slot}&therapist=eq.${therapist}`, { method: 'DELETE' }).then(() => {
        const logPayload = { date, slot, therapist, emp_id: targetEmpId, emp_name: targetEmpName, action: 'CANCEL' };
        supabaseFetch('booking_logs', { method: 'POST', body: JSON.stringify(logPayload) });
        toggleLoading(false); loadTable(); Swal.fire('ยกเลิกแล้ว', 'ลบการจองเรียบร้อย', 'success');
      });
    }
  });
}

function adminCheckIn(slot, therapist, status) {
  supabaseFetch(`bookings?date=eq.${lastRes.targetDate}&slot=eq.${slot}&therapist=eq.${therapist}`, {
    method: 'PATCH', body: JSON.stringify({ check_in_status: status })
  }).then(() => loadTable());
}

function updateAdminUI() {
  const status = $('#sysToggle').val(), date = $('#adminActiveDate').val(), disabledT = $('#disabledTherapists').val() || [];
  if(!date) return Swal.fire('แจ้งเตือน','กรุณาระบุวันที่','warning');
  toggleLoading(true);
  supabaseFetch('settings?id=eq.1', {
    method: 'PATCH', body: JSON.stringify({ status, active_date: date, disabled_therapists: disabledT.join(',') })
  }).then(() => { toggleLoading(false); Swal.fire('สำเร็จ', 'อัปเดตเรียบร้อย', 'success'); loadTable(); });
}

function adminClearAll() {
  Swal.fire({ title: 'ล้างตารางทั้งหมด?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545' }).then((result) => {
    if (result.isConfirmed) {
      toggleLoading(true);
      supabaseFetch(`bookings?date=eq.${lastRes.targetDate}`, { method: 'DELETE' }).then(() => { toggleLoading(false); loadTable(); Swal.fire('สำเร็จ', 'ล้างตารางเรียบร้อย', 'success'); });
    }
  });
}