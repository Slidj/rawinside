const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

document.body.style.backgroundColor = '#0a0e17';

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

const CHANNEL_USERNAME = 'rawinside_news'; 

const RSS_SERVICES = [
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`,
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`,
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`
];

const DEFAULT_IMAGE = 'https://placehold.co/800x400/141e30/ffffff?text=NEWS';

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ (Автоматичне)
// ==========================================

// Функція завантаження
// isBackground = true (якщо це авто-оновлення, щоб не показувати спінер)
async function loadNews(isBackground = false) {
    const container = document.getElementById('news-feed');
    
    // Якщо це перший запуск - показуємо напис "Завантаження"
    // Якщо це авто-оновлення - не чіпаємо екран, поки не отримаємо дані
    if (!isBackground) {
        container.innerHTML = '<div class="loading">Завантаження стрічки...</div>';
    }

    // Унікальний ключ, щоб сервер думав, що це новий запит (обхід кешу)
    const cacheBuster = Date.now() + Math.floor(Math.random() * 1000);

    for (let i = 0; i < RSS_SERVICES.length; i++) {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_SERVICES[i])}&api_key=kq5b546876547657567&t=${cacheBuster}`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items.length > 0) {
                // Якщо ми отримали нові дані - очищаємо контейнер і малюємо нові
                container.innerHTML = ''; 
                data.items.forEach(item => {
                    const parsedItem = parseTelegramPost(item);
                    if (parsedItem) createCard(parsedItem);
                });
                
                if (!isBackground) {
                    tg.HapticFeedback.notificationOccurred('success');
                }
                return; 
            }
        } catch (e) {
            console.warn(`Дзеркало ${i} пропущено.`);
        }
    }

    if (!isBackground) {
        container.innerHTML = `<div class="error">Помилка завантаження @${CHANNEL_USERNAME}</div>`;
        tg.HapticFeedback.notificationOccurred('error');
    }
}

// ==========================================
// ⏰ ТАЙМЕР АВТО-ОНОВЛЕННЯ
// ==========================================

// Запускаємо перше завантаження одразу
loadNews(false);

// Ставимо таймер на кожні 60 секунд (60000 мс)
setInterval(() => {
    console.log("Авто-оновлення новин...");
    loadNews(true); // true = тихий режим
}, 60000);


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
    if (videoSrc && !imageSrc) imageSrc = DEFAULT_IMAGE;
    if (!imageSrc) imageSrc = DEFAULT_IMAGE;

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
