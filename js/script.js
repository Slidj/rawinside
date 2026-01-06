const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

document.body.style.backgroundColor = '#000000';

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

// Спробуй 'tsnug' для тесту відео, або свій публічний канал
const CHANNEL_USERNAME = 'ssternenko'; 

// Ці сервіси вміють діставати відео-посилання з Телеграму
const RSS_SERVICES = [
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`,
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`,
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`
];

const DEFAULT_IMAGE = 'https://placehold.co/800x400/111/333?text=NEWS';

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ
// ==========================================

async function loadNews() {
    const container = document.getElementById('news-feed');
    container.innerHTML = '<div class="loading">Завантаження контенту...</div>';

    for (let i = 0; i < RSS_SERVICES.length; i++) {
        // nocache - щоб завжди свіже
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_SERVICES[i])}&nocache=${Date.now()}`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items.length > 0) {
                container.innerHTML = ''; 
                data.items.forEach(item => {
                    const parsedItem = parseTelegramPost(item);
                    if (parsedItem) createCard(parsedItem);
                });
                return; 
            }
        } catch (e) {
            console.warn(`Спроба ${i} невдала.`);
        }
    }

    container.innerHTML = `<div class="error">Помилка доступу до @${CHANNEL_USERNAME}</div>`;
}

// ==========================================
// 🧠 ПАРСЕР (ВИТЯГУЄМО ВІДЕО)
// ==========================================

function parseTelegramPost(item) {
    let imageSrc = DEFAULT_IMAGE;
    let videoSrc = null;

    // 1. Створюємо віртуальний елемент, щоб прочитати HTML поста
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = item.description;

    // 2. Шукаємо ВІДЕО (тег <video>)
    let videoTag = tempDiv.querySelector('video');
    if (videoTag && videoTag.src) {
        videoSrc = videoTag.src; // Оце пряме посилання на mp4!
    }

    // 3. Шукаємо КАРТИНКУ
    // Спочатку пробуємо знайти постер відео або картинку в enclosure
    if (item.enclosure?.link && !item.enclosure.link.includes('mp4')) {
        imageSrc = item.enclosure.link;
    } 
    // Якщо немає, шукаємо в <img> тегах
    else {
        let imgTag = tempDiv.querySelector('img');
        if (imgTag) imageSrc = imgTag.src;
    }

    // Якщо це відео, але картинки-прев'ю немає - ставимо заглушку або thumbnail
    if (videoSrc && imageSrc === DEFAULT_IMAGE && item.thumbnail) {
        imageSrc = item.thumbnail;
    }

    // Проксіювання картинки (щоб не було битих)
    if (imageSrc !== DEFAULT_IMAGE && !imageSrc.includes('wsrv.nl')) {
        imageSrc = `https://wsrv.nl/?url=${encodeURIComponent(imageSrc)}&w=600&output=jpg`;
    }

    // Текст
    let cleanText = tempDiv.innerText || "";
    cleanText = cleanText.trim();
    if (!cleanText) cleanText = videoSrc ? "Дивитись відео" : "";

    // Дата
    const dateObj = new Date(item.pubDate);
    const dateStr = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });

    return {
        title: item.title && !item.title.startsWith('http') ? item.title : "Новина",
        short: cleanText.substring(0, 80) + "...",
        full: cleanText,
        image: imageSrc,
        video: videoSrc, // Якщо null - це фото-пост, якщо є посилання - це відео
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

    // Якщо це відео - додаємо значок
    const badge = newsItem.video ? '<div class="video-badge">▶ ВІДЕО</div>' : '';

    card.innerHTML = `
        <div style="position:relative;">
            <img src="${newsItem.image}" class="card-media" loading="lazy" onerror="this.src='${DEFAULT_IMAGE}'">
            ${badge}
        </div>
        <div class="card-content">
            <div class="card-title">${newsItem.title}</div>
            <p class="card-desc">${newsItem.short}</p>
            <div class="card-meta">${newsItem.date}</div>
        </div>
    `;
    container.appendChild(card);
}

// ==========================================
// 🎬 ПЛЕЄР (МОДАЛКА)
// ==========================================

function openModal(newsItem) {
    const mediaContainer = document.getElementById('media-container');
    mediaContainer.innerHTML = ''; // Очистка

    // ЛОГІКА ВИБОРУ ПЛЕЄРА
    if (newsItem.video) {
        // --- ВАРІАНТ 1: ВІДЕО ---
        // Створюємо рідний HTML5 плеєр
        const video = document.createElement('video');
        video.className = 'app-video';
        video.src = newsItem.video;
        video.controls = true;   // Показуємо кнопки паузи/гучності
        video.autoplay = true;   // Автостарт
        video.playsInline = true; // Важливо для iPhone
        video.loop = true;       // Зациклити
        
        // Обробка помилки відео (якщо посилання застаріло)
        video.onerror = () => {
            mediaContainer.innerHTML = '<p style="color:#666; padding:20px;">Відео недоступне для прямого перегляду</p>';
        };
        
        mediaContainer.appendChild(video);
    } else {
        // --- ВАРІАНТ 2: ФОТО ---
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
    
    // Зупиняємо відео при закритті
    const mediaContainer = document.getElementById('media-container');
    mediaContainer.innerHTML = ''; 
    
    tg.BackButton.hide();
}

loadNews();
