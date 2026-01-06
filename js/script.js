const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

document.body.style.backgroundColor = '#000000';

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

// ✅ Твій канал
const CHANNEL_USERNAME = 'rawinside_news'; 

// ✅ Порядок важливий! rsshub найкраще працює з відео
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
    container.innerHTML = '<div class="loading">Завантаження стрічки...</div>';

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
            console.warn(`Дзеркало ${i} пропущено.`);
        }
    }

    container.innerHTML = `<div class="error">Помилка завантаження @${CHANNEL_USERNAME}</div>`;
}

// ==========================================
// 🧠 ПАРСЕР
// ==========================================

function parseTelegramPost(item) {
    let imageSrc = null;
    let videoSrc = null;

    // 1. Створюємо віртуальний елемент
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = item.description;

    // --- ЛОГІКА ПОШУКУ ВІДЕО ---
    
    // А) Шукаємо в enclosure (стандарт RSS)
    if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('video/')) {
        videoSrc = item.enclosure.link;
    }
    
    // Б) Шукаємо тег <video> в описі
    if (!videoSrc) {
        let videoTag = tempDiv.querySelector('video');
        if (videoTag && videoTag.src) videoSrc = videoTag.src;
    }

    // --- ЛОГІКА ПОШУКУ КАРТИНКИ (для прев'ю) ---
    
    // А) Шукаємо в enclosure (якщо це картинка)
    if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
        imageSrc = item.enclosure.link;
    }
    
    // Б) Шукаємо <img> тег
    if (!imageSrc) {
        let imgTag = tempDiv.querySelector('img');
        if (imgTag) imageSrc = imgTag.src;
    }
    
    // В) Якщо нічого немає, беремо thumbnail
    if (!imageSrc && item.thumbnail) imageSrc = item.thumbnail;
    
    // Г) Якщо є відео, але немає картинки - ставимо заглушку для прев'ю
    if (videoSrc && !imageSrc) imageSrc = DEFAULT_IMAGE;
    
    // Д) Фінал - заглушка
    if (!imageSrc) imageSrc = DEFAULT_IMAGE;

    // Проксіювання картинки (wsrv.nl для швидкості і обходу блоку)
    // НЕ проксіюємо відео! Тільки картинки.
    if (imageSrc && !imageSrc.includes('wsrv.nl') && !imageSrc.includes('placehold')) {
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

    // Показуємо значок Play, якщо це відео
    const playOverlay = newsItem.video ? '<div class="play-icon-overlay"></div>' : '';

    card.innerHTML = `
        <div class="card-media-wrapper">
            <img src="${newsItem.image}" class="card-media" loading="lazy" onerror="this.src='${DEFAULT_IMAGE}'">
            ${playOverlay}
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
    mediaContainer.innerHTML = ''; 

    if (newsItem.video) {
        // --- ВІДЕО ---
        const video = document.createElement('video');
        video.className = 'app-video';
        video.src = newsItem.video;
        
        // Автостарт БЕЗ звуку (вимога браузерів)
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true; 
        video.loop = true;
        video.controls = true; // Користувач сам ввімкне звук
        
        // 🔥 ЗАХИСТ ВІД ПОМИЛКИ "PROTECTED" 🔥
        // Якщо відео не вантажиться (403 помилка), міняємо на картинку
        video.onerror = () => {
            console.log("Відео не вдалося завантажити, показуємо фото.");
            mediaContainer.innerHTML = ''; // Видаляємо бите відео
            
            // Створюємо картинку замість відео
            const fallbackImg = document.createElement('img');
            fallbackImg.className = 'app-image';
            fallbackImg.src = newsItem.image; // Беремо прев'ю
            mediaContainer.appendChild(fallbackImg);
            
            // Додаємо напис
            const msg = document.createElement('p');
            msg.style.color = '#aaa';
            msg.style.textAlign = 'center';
            msg.style.marginTop = '10px';
            msg.innerText = '(Відео доступне в каналі)';
            mediaContainer.appendChild(msg);
        };
        
        mediaContainer.appendChild(video);
    } else {
        // --- ФОТО ---
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
    // Зупиняємо відео
    setTimeout(() => { document.getElementById('media-container').innerHTML = ''; }, 300);
    tg.BackButton.hide();
}

loadNews();
