const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

document.body.style.backgroundColor = '#0a0e17';

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

const CHANNEL_USERNAME = 'rawinside_news'; 

// 🔥 РОЗШИРЕНИЙ СПИСОК ДЗЕРКАЛ (Backup System) 🔥
// Якщо перше не працює, скрипт піде на друге, третє і т.д.
const RSS_SERVICES = [
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`,
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`,
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`,
    `https://hub.mosil.biz/telegram/channel/${CHANNEL_USERNAME}` // Додав ще одне резервне
];

const DEFAULT_IMAGE = 'https://placehold.co/800x400/141e30/ffffff?text=INSIDE';

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ (Auto Update)
// ==========================================

async function loadNews(isBackground = false) {
    const container = document.getElementById('news-feed');
    
    if (!isBackground) {
        container.innerHTML = '<div class="loading">Завантаження стрічки...</div>';
    }

    // Унікальний ключ часу (обхід кешу)
    const cacheBuster = Date.now();

    for (let i = 0; i < RSS_SERVICES.length; i++) {
        // 🔥 ПРИБРАВ ЛІМІТОВАНИЙ API KEY, залишив чистий запит 🔥
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_SERVICES[i])}&t=${cacheBuster}`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items.length > 0) {
                container.innerHTML = ''; 
                data.items.forEach(item => {
                    const parsedItem = parseTelegramPost(item);
                    if (parsedItem) createCard(parsedItem);
                });
                
                if (!isBackground) {
                    tg.HapticFeedback.notificationOccurred('success');
                }
                // Якщо вдалось завантажити - виходимо з циклу і не мучимо інші сервери
                return; 
            }
        } catch (e) {
            console.warn(`Дзеркало ${i} (${RSS_SERVICES[i]}) не відповіло.`);
        }
    }

    // Якщо ми тут - значить всі дзеркала відмовили
    if (!isBackground) {
        container.innerHTML = `
            <div class="error">
                <p>⚠️ Перевантаження серверів</p>
                <small>Спробуйте перезайти через хвилину</small>
            </div>`;
        tg.HapticFeedback.notificationOccurred('error');
    }
}

// ==========================================
// ⏰ ТАЙМЕР АВТО-ОНОВЛЕННЯ
// ==========================================

loadNews(false);

// Збільшив час до 120 секунд (2 хвилини), щоб не блокувало
setInterval(() => {
    loadNews(true); 
}, 120000); 


// ==========================================
// 🧠 ПАРСЕР
// ==========================================

function parseTelegramPost(item) {
    let imageSrc = null;
    let videoSrc = null;
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = item.description;

    // 1. ВІДЕО
    if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('video/')) {
        videoSrc = item.enclosure.link;
    }
    if (!videoSrc) {
        let videoTag = tempDiv.querySelector('video');
        if (videoTag && videoTag.src) videoSrc = videoTag.src;
    }

    // 2. КАРТИНКА
    if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
        imageSrc = item.enclosure.link;
    }
    if (!imageSrc) {
        let imgTag = tempDiv.querySelector('img');
        if (imgTag) imageSrc = imgTag.src;
    }
    if (!imageSrc && item.thumbnail) imageSrc = item.thumbnail;
    
    // Якщо є відео, але немає картинки - заглушка
    if (videoSrc && !imageSrc) imageSrc = DEFAULT_IMAGE;
    // Якщо взагалі нічого - заглушка
    if (!imageSrc) imageSrc = DEFAULT_IMAGE;

    // Проксі тільки для реальних картинок (не для заглушок)
    if (imageSrc && !imageSrc.includes('wsrv.nl') && !imageSrc.includes('placehold')) {
        imageSrc = `https://wsrv.nl/?url=${encodeURIComponent(imageSrc)}&w=600&output=jpg`;
    }

    // 3. ТЕКСТ
    let cleanText = tempDiv.innerText || "";
    cleanText = cleanText.trim();
    if (!cleanText) cleanText = videoSrc ? "Відео новина" : "";

    cleanText = cleanText.replace(/^\[[^\]]+\]\s*/, '');

    let words = cleanText.split(/\s+/);
    let shortTitle = words.slice(0, 4).join(' ');
    if (words.length > 4) shortTitle += "...";

    const dateObj = new Date(item.pubDate);
    const dateStr = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });

    return {
        title: shortTitle, 
        full: cleanText,  
        image: imageSrc,
        video: videoSrc, 
        date: dateStr,
        link: item.link
    };
}

// ==========================================
// 🎨 КАРТКА
// ==========================================

function createCard(newsItem) {
    const container = document.getElementById('news-feed');
    const card = document.createElement('div');
    card.className = 'news-card';
    card.onclick = () => openModal(newsItem);

    const playOverlay = newsItem.video ? '<div class="play-icon-overlay"></div>' : '';

    card.innerHTML = `
        <div class="card-media-wrapper">
            <img src="${newsItem.image}" class="card-media" loading="lazy" onerror="this.src='${DEFAULT_IMAGE}'">
            ${playOverlay}
        </div>
        <div class="card-content">
            <div class="card-title">${newsItem.title}</div>
            <div class="card-meta">${newsItem.date}</div>
        </div>
    `;
    container.appendChild(card);
}

// ==========================================
// 🎬 ПЛЕЄР
// ==========================================

function openModal(newsItem) {
    const mediaContainer = document.getElementById('media-container');
    mediaContainer.innerHTML = ''; 

    if (newsItem.video) {
        const video = document.createElement('video');
        video.className = 'app-video';
        video.src = newsItem.video;
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true; 
        video.loop = true;
        video.controls = true; 
        
        video.onerror = () => {
            mediaContainer.innerHTML = ''; 
            const fallbackImg = document.createElement('img');
            fallbackImg.className = 'app-image';
            fallbackImg.src = newsItem.image;
            mediaContainer.appendChild(fallbackImg);
            const msg = document.createElement('p');
            msg.style.color = '#aaa';
            msg.style.textAlign = 'center';
            msg.style.marginTop = '10px';
            msg.innerText = '(Відео доступне в каналі)';
            mediaContainer.appendChild(msg);
        };
        mediaContainer.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.className = 'app-image';
        img.src = newsItem.image;
        mediaContainer.appendChild(img);
    }

    document.getElementById('modal-title').innerText = newsItem.title; 
    document.getElementById('modal-date').innerText = newsItem.date;
    document.getElementById('modal-text').innerText = newsItem.full;
    document.getElementById('modal-link').href = newsItem.link;

    document.getElementById('news-modal').classList.add('active');
    tg.BackButton.show();
    tg.BackButton.onClick(closeModal);
}

function closeModal() {
    document.getElementById('news-modal').classList.remove('active');
    setTimeout(() => { document.getElementById('media-container').innerHTML = ''; }, 300);
    tg.BackButton.hide();
}
