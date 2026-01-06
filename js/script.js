const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

document.body.style.backgroundColor = '#0a0e17';

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

const CHANNEL_USERNAME = 'rawinside_news'; 

// Використовуємо найнадійніші дзеркала
const BASE_RSS_URLS = [
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`,
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`,
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`
];

const DEFAULT_IMAGE = 'https://placehold.co/800x400/141e30/ffffff?text=INSIDE';

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ (JSON + ANTI-CACHE)
// ==========================================

async function loadNews(isBackground = false) {
    const container = document.getElementById('news-feed');
    
    // Показуємо напис тільки при першому вході
    if (!isBackground) {
        container.innerHTML = '<div class="loading">Завантаження стрічки...</div>';
    }

    // 🔥 ЯДЕРНИЙ АНТИ-КЕШ 🔥
    // Генеруємо випадкове число
    const randomParam = Math.floor(Math.random() * 99999);

    for (let i = 0; i < BASE_RSS_URLS.length; i++) {
        // Ми додаємо випадкове число ПРЯМО В URL КАНАЛУ
        // Це змушує OpenRSS/RSSHub думати, що це новий запит і віддавати свіжі дані
        const freshRssUrl = `${BASE_RSS_URLS[i]}?random_check=${randomParam}`;
        
        // І ще одне випадкове число для самого rss2json
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(freshRssUrl)}&api_key=kq5b546876547657567`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items.length > 0) {
                container.innerHTML = ''; 
                
                data.items.forEach(item => {
                    // Обгортаємо в try-catch, щоб один битий пост не зламав всю стрічку
                    try {
                        const parsedItem = parseTelegramPost(item);
                        if (parsedItem) createCard(parsedItem);
                    } catch (err) {
                        console.error("Помилка поста:", err);
                    }
                });
                
                if (!isBackground) tg.HapticFeedback.notificationOccurred('success');
                return; // Все супер, виходимо
            }
        } catch (e) {
            console.warn(`Дзеркало ${i} не відповіло.`);
        }
    }

    if (!isBackground) {
        container.innerHTML = `
            <div class="error">
                <p>Немає зв'язку з сервером</p>
                <small style="opacity:0.5">Спробуйте пізніше</small>
            </div>`;
        tg.HapticFeedback.notificationOccurred('error');
    }
}

// Запуск (оновлення кожні 90 секунд)
loadNews(false);
setInterval(() => { loadNews(true); }, 90000); 


// ==========================================
// 🧠 ПАРСЕР (ВСЕЇДНИЙ + АЛЬБОМИ)
// ==========================================

function parseTelegramPost(item) {
    let imageSrc = null;
    let videoSrc = null;
    
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = item.description || "";

    // --- ОБРОБКА АЛЬБОМІВ (МАСИВІВ) ---
    // rss2json іноді повертає enclosure як масив, якщо там багато фото
    let enclosure = item.enclosure;
    if (Array.isArray(enclosure) && enclosure.length > 0) {
        // Шукаємо перше відео або перше фото в масиві
        let vid = enclosure.find(e => e.type.includes('video'));
        let img = enclosure.find(e => e.type.includes('image'));
        
        if (vid) {
            enclosure = vid; // Пріоритет відео
        } else if (img) {
            enclosure = img;
        } else {
            enclosure = enclosure[0];
        }
    }

    // 1. ВІДЕО
    if (enclosure && enclosure.type && enclosure.type.includes('video')) {
        videoSrc = enclosure.link;
    }
    if (!videoSrc) {
        let videoTag = tempDiv.querySelector('video');
        if (videoTag && videoTag.src) videoSrc = videoTag.src;
    }

    // 2. КАРТИНКА
    if (enclosure && enclosure.type && enclosure.type.includes('image')) {
        imageSrc = enclosure.link;
    }
    if (!imageSrc) {
        let imgTag = tempDiv.querySelector('img');
        if (imgTag) imageSrc = imgTag.src;
    }
    if (!imageSrc && item.thumbnail) {
        imageSrc = item.thumbnail;
    }
    
    // Regex (запасний варіант)
    if (!imageSrc && item.description) {
        const imgRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|webp))/i;
        const match = item.description.match(imgRegex);
        if (match) imageSrc = match[1];
    }

    // Заглушки
    if (videoSrc && !imageSrc) imageSrc = DEFAULT_IMAGE;
    if (!imageSrc) imageSrc = DEFAULT_IMAGE;

    // Проксі (wsrv.nl)
    if (imageSrc !== DEFAULT_IMAGE && !imageSrc.includes('wsrv.nl')) {
        imageSrc = `https://wsrv.nl/?url=${encodeURIComponent(imageSrc)}&w=600&output=jpg`;
    }

    // 3. ТЕКСТ
    let cleanText = tempDiv.innerText || "";
    cleanText = cleanText.trim();
    
    if (!cleanText) {
        if (videoSrc) cleanText = "Відео новина";
        else if (imageSrc !== DEFAULT_IMAGE) cleanText = "Фото новина";
        else cleanText = "Новина";
    }

    cleanText = cleanText.replace(/^\[[^\]]+\]\s*/, '');
    
    // Короткий заголовок (4 слова)
    let words = cleanText.split(/\s+/);
    let shortTitle = words.slice(0, 4).join(' ');
    if (words.length > 4) shortTitle += "...";

    const dateObj = new Date(item.pubDate);
    const dateStr = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

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
