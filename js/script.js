const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

document.body.style.backgroundColor = '#0a0e17';

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

const CHANNEL_USERNAME = 'rawinside_news'; 

// Найстабільніші мости для Telegram
// Ми використовуємо їх по черзі, якщо перший не відповідає
const RSS_BRIDGES = [
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`,
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`,
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`
];

const DEFAULT_IMAGE = 'https://placehold.co/800x400/141e30/ffffff?text=INSIDE';

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ (SIMPLE FETCH)
// ==========================================

async function loadNews(isBackground = false) {
    const container = document.getElementById('news-feed');
    
    if (!isBackground) {
        container.innerHTML = '<div class="loading">Завантаження стрічки...</div>';
    }

    // Легкий анти-кеш тільки для браузера (не для сервера)
    const timeStamp = Math.floor(Date.now() / 60000); // Змінюється раз на хвилину

    for (let i = 0; i < RSS_BRIDGES.length; i++) {
        // Використовуємо стандартний rss2json БЕЗ ключів (щоб не було лімітів)
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_BRIDGES[i])}&_=${timeStamp}`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items.length > 0) {
                container.innerHTML = ''; 
                
                data.items.forEach(item => {
                    try {
                        const parsedItem = parseTelegramPost(item);
                        if (parsedItem) createCard(parsedItem);
                    } catch (err) {
                        console.error("Помилка поста:", err);
                    }
                });
                
                if (!isBackground) tg.HapticFeedback.notificationOccurred('success');
                return; // Успіх!
            }
        } catch (e) {
            console.warn(`Міст ${i} не відповідає, пробуємо наступний...`);
        }
    }

    if (!isBackground) {
        container.innerHTML = `
            <div class="error">
                <p>Немає з'єднання</p>
                <small style="opacity:0.5">Спробуйте пізніше</small>
            </div>`;
        tg.HapticFeedback.notificationOccurred('error');
    }
}

// Оновлюємо кожні 2 хвилини
loadNews(false);
setInterval(() => { loadNews(true); }, 120000); 


// ==========================================
// 🧠 ПАРСЕР (Виправлено альбоми)
// ==========================================

function parseTelegramPost(item) {
    let imageSrc = null;
    let videoSrc = null;
    
    // Створюємо HTML-аналізатор
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = item.description || "";

    // --- ОБРОБКА ВЛОЖЕНЬ (ENCLOSURE) ---
    // Це критично важливо для альбомів
    let enclosure = item.enclosure;
    
    // 1. Якщо це масив (альбом)
    if (Array.isArray(enclosure) && enclosure.length > 0) {
        // Пріоритет: Відео -> Картинка
        let vid = enclosure.find(e => e.type && e.type.includes('video'));
        let img = enclosure.find(e => e.type && e.type.includes('image'));
        enclosure = vid || img || enclosure[0];
    }

    // 2. Якщо це один об'єкт
    if (enclosure && enclosure.type) {
        if (enclosure.type.includes('video')) videoSrc = enclosure.link;
        if (enclosure.type.includes('image')) imageSrc = enclosure.link;
    }

    // --- ПОШУК У HTML (ЯКЩО ENCLOSURE ПУСТИЙ) ---
    if (!videoSrc) {
        let videoTag = tempDiv.querySelector('video');
        if (videoTag && videoTag.src) videoSrc = videoTag.src;
    }

    if (!imageSrc) {
        let imgTag = tempDiv.querySelector('img');
        if (imgTag) imageSrc = imgTag.src;
    }

    // Запасний варіант для картинок (Thumbnail)
    if (!imageSrc && item.thumbnail) imageSrc = item.thumbnail;

    // Заглушки
    if (videoSrc && !imageSrc) imageSrc = DEFAULT_IMAGE;
    if (!imageSrc) imageSrc = DEFAULT_IMAGE;

    // Проксі для картинок
    if (imageSrc !== DEFAULT_IMAGE && !imageSrc.includes('wsrv.nl')) {
        imageSrc = `https://wsrv.nl/?url=${encodeURIComponent(imageSrc)}&w=600&output=jpg`;
    }

    // --- ТЕКСТ ---
    let cleanText = tempDiv.innerText || "";
    cleanText = cleanText.trim();
    
    // Якщо тексту немає
    if (!cleanText) {
        if (videoSrc) cleanText = "Відео";
        else if (imageSrc !== DEFAULT_IMAGE) cleanText = "Фото";
        else cleanText = "Новина";
    }

    // Прибираємо [Video] та інші теги
    cleanText = cleanText.replace(/^\[[^\]]+\]\s*/, '');
    
    // Короткий заголовок (4 слова)
    let words = cleanText.split(/\s+/);
    let shortTitle = words.slice(0, 4).join(' ');
    if (words.length > 4) shortTitle += "...";

    // Дата
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
