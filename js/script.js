const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation(); // Запитувати перед закриттям

// Налаштування кольорів (Форсуємо темну тему для кіношного ефекту)
document.body.style.backgroundColor = '#000000';
document.body.style.color = '#ffffff';

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

// Спробуй канал 'tsnug' або свій власний
const CHANNEL_USERNAME = 'tsnug'; 

const RSS_SERVICES = [
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`,
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`,
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`
];

// Заглушка
const DEFAULT_IMAGE = 'https://placehold.co/800x600/111/333?text=NO+IMAGE';

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ
// ==========================================

async function loadNews() {
    const container = document.getElementById('news-feed');
    container.innerHTML = '<div class="loading">Завантаження стрічки...</div>';

    for (let i = 0; i < RSS_SERVICES.length; i++) {
        // nocache щоб бачити нові пости
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
            console.warn(`Дзеркало ${i} пропущено.`);
        }
    }

    container.innerHTML = `<div class="error">Помилка завантаження каналу @${CHANNEL_USERNAME}</div>`;
}

// ==========================================
// 🧠 ОБРОБКА ДАНИХ
// ==========================================

function parseTelegramPost(item) {
    // 1. Шукаємо картинку для прев'ю
    let imageSrc = item.enclosure?.link;
    if (!imageSrc) {
        const imgRegex = /src="([^"]+)"/;
        const match = item.description.match(imgRegex);
        if (match) imageSrc = match[1];
    }
    if (!imageSrc && item.thumbnail) imageSrc = item.thumbnail;
    
    // Якщо це відео-файл в RSS, ставимо заглушку для прев'ю
    // (Але всередині модалки ми покажемо реальне відео)
    let isVideo = false;
    if (imageSrc && (imageSrc.includes('.mp4') || imageSrc.includes('video'))) {
        isVideo = true;
        imageSrc = DEFAULT_IMAGE; 
    }
    
    // Проксі для картинок прев'ю
    if (imageSrc && !imageSrc.includes('placehold') && !imageSrc.includes('wsrv.nl')) {
        imageSrc = `https://wsrv.nl/?url=${encodeURIComponent(imageSrc)}&w=600&output=jpg`;
    }
    
    if (!imageSrc) imageSrc = DEFAULT_IMAGE;

    // Текст
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = item.description;
    let cleanText = tempDiv.innerText || "";
    cleanText = cleanText.trim();
    
    if (!cleanText) cleanText = isVideo ? "Натисни, щоб подивитись відео" : "";

    // Дата
    const dateObj = new Date(item.pubDate);
    const dateStr = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });

    return {
        title: item.title && !item.title.startsWith('http') ? item.title : "Без заголовка",
        short: cleanText.substring(0, 100) + "...",
        full: cleanText,
        image: imageSrc,
        date: dateStr,
        link: item.link, // https://t.me/channel/123
        isVideo: isVideo
    };
}

// ==========================================
// 🎨 ІНТЕРФЕЙС (СТРІЧКА)
// ==========================================

function createCard(newsItem) {
    const container = document.getElementById('news-feed');
    const card = document.createElement('div');
    card.className = 'news-card';
    card.onclick = () => openModal(newsItem);

    card.innerHTML = `
        <img src="${newsItem.image}" class="card-media" loading="lazy" onerror="this.src='${DEFAULT_IMAGE}'">
        <div class="card-content">
            <div class="card-title">${newsItem.title}</div>
            <p class="card-desc">${newsItem.short}</p>
            <div class="card-meta">${newsItem.date}</div>
        </div>
    `;
    container.appendChild(card);
}

// ==========================================
// 📱 МОДАЛЬНЕ ВІКНО (ПЛЕЄР)
// ==========================================

function openModal(newsItem) {
    const mediaContainer = document.getElementById('media-container');
    mediaContainer.innerHTML = ''; // Чистимо

    // --- ЛОГІКА ВІДЕО/ФОТО ---
    
    // Розбираємо посилання, щоб отримати channel/id
    const linkParts = newsItem.link.split('t.me/');
    const postAddress = linkParts.length > 1 ? linkParts[1] : null;

    if (postAddress) {
        // Ми використовуємо IFRAME замість віджета. Це виглядає як рідний плеєр.
        // embed=1 : режим вбудовування
        // dark=1 : темна тема
        // single=1 : показувати тільки це медіа (без сусідніх постів)
        const iframe = document.createElement('iframe');
        iframe.src = `https://t.me/${postAddress}?embed=1&dark=1&single=1`;
        iframe.className = 'telegram-iframe';
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', 'true'); // Дозволити повний екран
        
        mediaContainer.appendChild(iframe);
    } else {
        // Якщо раптом посилання бите - показуємо просто картинку
        const img = document.createElement('img');
        img.src = newsItem.image;
        img.className = 'modal-full-img';
        mediaContainer.appendChild(img);
    }

    // Текстові дані
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
    // Очищаємо контейнер, щоб відео зупинилось (важливо!)
    setTimeout(() => {
        document.getElementById('media-container').innerHTML = '';
    }, 300);
    tg.BackButton.hide();
}

// Запуск
loadNews();
