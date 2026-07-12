const todoView = document.getElementById('todo-view');
const chatView = document.getElementById('chat-view');
const mainInput = document.getElementById('main-input');
const taskList = document.getElementById('task-list');
const submitBtn = document.getElementById('submit-btn');
const emptyState = document.getElementById('empty-state');

let socket = null;
let messageCount = 0;

// فحص حالة المهام لإظهار أو إخفاء صورة العادات
function checkEmptyState() {
    if (taskList.children.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
    }
}

window.onload = async () => {
    const res = await fetch('/api/tasks');
    const tasks = await res.json();
    tasks.forEach(t => renderTask(t.id, t.task));
    checkEmptyState();
};

submitBtn.addEventListener('click', handleMainInput);
mainInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleMainInput(); });

async function handleMainInput() {
    const val = mainInput.value.trim();
    if (!val) return;

    mainInput.value = '';

    const res = await fetch('/api/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: val })
    });
    const data = await res.json();

    if (data.action === 'CHAT_ACCESS') {
        activateStealthMode(data.token);
    } else if (data.action === 'TASK_ADDED') {
        renderTask(data.id, data.task);
    }
}

function renderTask(id, taskText) {
    const li = document.createElement('li');
    li.textContent = taskText;

    const delBtn = document.createElement('button');
    delBtn.innerHTML = '✖';
    delBtn.className = 'delete-btn';
    delBtn.onclick = async () => {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        li.remove();
        checkEmptyState();
    };

    li.appendChild(delBtn);
    taskList.appendChild(li);
    checkEmptyState();
}

function activateStealthMode(token) {
    todoView.classList.add('hidden');
    chatView.classList.remove('hidden');

    socket = io({ auth: { token } });

    socket.on('chatHistory', (history) => {
        history.forEach(item => renderMessage(item, item.type));
    });

    socket.on('receiveMessage', (msgData) => {
        renderMessage(msgData, 'received');
        triggerNotificationCheck();
    });

    socket.on('typing', () => {
        const ind = document.getElementById('typing-indicator');
        ind.classList.remove('hidden');
        clearTimeout(window.typingTimeout);
        window.typingTimeout = setTimeout(() => ind.classList.add('hidden'), 1500);
    });
}

// === منطق إرسال الوسائط والرسائل ===
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const fileInput = document.getElementById('file-input');
const attachBtn = document.getElementById('attach-btn');

let selectedFile = null;
let selectedFileType = null;

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        alert("عذراً، حجم الملف يجب أن لا يتجاوز 10 ميجابايت.");
        fileInput.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
        selectedFile = evt.target.result;
        selectedFileType = file.type.startsWith('image/') ? 'image' : 'video';
        chatInput.placeholder = `تم إرفاق: ${file.name}`;
    };
    reader.readAsDataURL(file);
});

sendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (socket) socket.emit('typing');
    if (e.key === 'Enter') sendChatMessage();
});

function sendChatMessage() {
    const msgText = chatInput.value.trim();
    if (!msgText && !selectedFile) return;

    const msgData = {
        msg: msgText,
        fileData: selectedFile,
        fileType: selectedFileType
    };

    socket.emit('sendMessage', msgData);
    renderMessage(msgData, 'sent');
    
    chatInput.value = '';
    chatInput.placeholder = 'اكتب رسالة...';
    fileInput.value = '';
    selectedFile = null;
    selectedFileType = null;
    triggerNotificationCheck();
}

function renderMessage(data, type) {
    const div = document.createElement('div');
    div.classList.add('message', type);
    
    const msgText = typeof data === 'string' ? data : data.msg;
    const fileData = data.fileData;
    const fileType = data.fileType;

    if (msgText) {
        const p = document.createElement('p');
        p.textContent = msgText;
        div.appendChild(p);
    }

    if (fileData) {
        if (fileType === 'image') {
            const img = document.createElement('img');
            img.src = fileData;
            img.classList.add('media-content');
            div.appendChild(img);
        } else if (fileType === 'video') {
            const vid = document.createElement('video');
            vid.src = fileData;
            vid.controls = true;
            vid.classList.add('media-content');
            div.appendChild(vid);
        }
    }

    const chatContainer = document.getElementById('chat-messages');
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function triggerNotificationCheck() {
    messageCount++;
    if (messageCount % 3 === 0) {
        showFakeNotification("تذكير: قم بإنجاز مهامك المعلقة لهذا اليوم.");
    }
}

function showFakeNotification(text) {
    const banner = document.getElementById('notification-banner');
    banner.textContent = text;
    banner.classList.remove('hidden');
    setTimeout(() => {
        banner.classList.add('hidden');
    }, 4000);
}
