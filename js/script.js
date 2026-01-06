const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

document.body.style.backgroundColor = '#000000';

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

// Твій канал
const CHANNEL_USERNAME = 'tsnug'; 

// Змінив порядок: i-c-a.su краще працює з відео
const RSS_SERVICES = [
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`, 
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`,
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`
];

const DEFAULT_IMAGE = 'https://placehold.co/800x400/111/333?text=NO+IMAGE';

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

    container.innerHTML = `<div class="error">Помилка завантаження каналу @${CHANNEL_USERNAME}</div>`;
}

// ==========================================
// 🧠 ПАРСЕР (ВИТЯГУЄМО ВІДЕО)
// ==========================================

function parseTelegramPost(item) {
    let imageSrc = DEFAULT_IMAGE;
    let videoSrc = null;

    // 1. Створюємо віртуальний елемент
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = item.description;

    // 2. Шукаємо ВІДЕО (тег <video>) або enclosure типу video/mp4
    let videoTag = tempDiv.querySelector('video');
    if (videoTag && videoTag.src) {
        videoSrc = videoTag.src;
    } 
    // Перевірка через RSS enclosure (надійніше)
    else if (item.enclosure && item.enclosure.type && item.enclosure.type.includes('video')) {
        videoSrc = item.enclosure.link;
    }

    // 3. Шукаємо КАРТИНКУ
    if (item.enclosure && item.enclosure.type && item.enclosure.type.includes('image')) {
        imageSrc = item.enclosure.link;
    } else {
        let imgTag = tempDiv.querySelector('img');
        if (imgTag) imageSrc = imgTag.src;
    }
    
    // Якщо картинки немає, а є thumbnail від RSS
    if ((!imageSrc || imageSrc === DEFAULT_IMAGE) && item.thumbnail) {
        imageSrc = item.thumbnail;
    }

    // Проксіювання картинки (щоб не було битих)
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
// 🎬 ПЛЕЄР (ВИПРАВЛЕНО АВТОСТАРТ)
// ==========================================

function openModal(newsItem) {
    const mediaContainer = document.getElementById('media-container');
    mediaContainer.innerHTML = ''; 

    if (newsItem.video) {
        // --- ВІДЕО ПЛЕЄР ---
        const video = document.createElement('video');
        video.className = 'app-video';
        video.src = newsItem.video;
        
        // 🔥 ВАЖЛИВІ НАЛАШТУВАННЯ ДЛЯ АВТОСТАРТУ 🔥
        video.muted = true;       // Без звуку (обов'язково для автостарту!)
        video.autoplay = true;    // Автостарт
        video.playsInline = true; // Не відкривати на весь екран в iOS
        video.loop = true;        // По колу
        video.controls = true;    // Показувати кнопки (щоб увімкнути звук)
        
        // Спроба запустити
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Автостарт заблоковано браузером. Потрібен клік.");
                // Можна показати кнопку Play поверх, але controls=true має вистачити
            });
        }

        // Обробка помилки (якщо Телеграм не віддав файл)
        video.onerror = () => {
            console.error("Відео не вантажиться");
            mediaContainer.innerHTML = `
                <div style="position:relative; width:100%;">
                    <img src="${newsItem.image}" class="app-image" style="opacity:0.5;">
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
                        <p>Відео захищене</p>
                        <a href="${newsItem.link}" target="_blank" class="app-btn" style="padding:10px; font-size:0.8rem; margin-top:5px;">Дивитись в каналі</a>
                    </div>
                </div>
            `;
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
    setTimeout(() => {
        document.getElementById('media-container').innerHTML = '';
    }, 300);
    tg.BackButton.hide();
}

loadNews();
