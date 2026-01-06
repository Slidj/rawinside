const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

document.body.style.backgroundColor = '#0a0e17';

// ==========================================
// ⚙️ НАЛАШТУВАННЯ (ТВОЇ ПРАВИЛА)
// ==========================================

// 👇 ВСТАВ СЮДИ СВІЙ КЛЮЧ ВІД NEWSDATA.IO 👇
const API_KEY = 'pub_22e4e8780f9349e7a64a65f886ecae3a'; 

// Як часто оновлювати новини (у хвилинах)?
// 10 хвилин = економно для ліміту 200 запитів/день
const UPDATE_TIME_MINUTES = 10; 

// Параметри пошуку:
// country=ua (Україна)
// language=uk (Українська мова)
// category=top (Головні новини)
const API_URL = `https://newsdata.io/api/1/news?apikey=${API_KEY}&country=ua&language=uk&category=top`;

const DEFAULT_IMAGE = 'https://placehold.co/800x400/141e30/ffffff?text=INSIDE';

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ (STABLE API)
// ==========================================

async function loadNews(isBackground = false) {
    const container = document.getElementById('news-feed');
    
    if (!isBackground) {
        container.innerHTML = '<div class="loading">Завантаження стрічки...</div>';
    }

    try {
        const response = await fetch(API_URL);
        
        // Перевірка на помилку ліміту (429) або ключа (401)
        if (response.status === 429) {
            throw new Error('Ліміт запитів вичерпано (200/день)');
        }
        if (response.status === 401) {
            throw new Error('Невірний API Key');
        }

        const data = await response.json();

        if (data.status === 'success' && data.results.length > 0) {
            container.innerHTML = ''; 
            
            // NewsData віддає масив у полі 'results'
            data.results.forEach(item => {
                // Відфільтруємо новини без картинок, щоб було красиво (за бажанням)
                // if (!item.image_url) return; 

                const parsedItem = parseNewsDataPost(item);
                createCard(parsedItem);
            });
            
            if (!isBackground) tg.HapticFeedback.notificationOccurred('success');
        } else {
            throw new Error('Новин не знайдено');
        }

    } catch (e) {
        console.error(e);
        if (!isBackground) {
            container.innerHTML = `
                <div class="error">
                    <p>Помилка: ${e.message}</p>
                    <small style="opacity:0.5">Перевірте ключ або ліміти</small>
                </div>`;
            tg.HapticFeedback.notificationOccurred('error');
        }
    }
}

// Запуск при старті
loadNews(false);

// Автоматичний таймер (твоя частота)
setInterval(() => { 
    console.log("Авто-оновлення...");
    loadNews(true); 
}, UPDATE_TIME_MINUTES * 60 * 1000); 


// ==========================================
// 🧠 ПАРСЕР (NEWSDATA.IO FORMAT)
// ==========================================

function parseNewsDataPost(item) {
    // 1. Картинка
    // Якщо image_url немає, ставимо заглушку
    let imageSrc = item.image_url || DEFAULT_IMAGE;

    // Проксіювання картинки (щоб вантажилась швидко і мала правильний розмір)
    if (imageSrc !== DEFAULT_IMAGE) {
        // NewsData іноді дає http посилання, які Телеграм не любить. Wsrv це фіксить.
        imageSrc = `https://wsrv.nl/?url=${encodeURIComponent(imageSrc)}&w=600&output=jpg`;
    }

    // 2. Відео
    // NewsData рідко дає прямі посилання на відео, здебільшого video_url це посилання на YouTube
    let videoSrc = item.video_url || null;

    // 3. Текст і заголовок
    let title = item.title || "Без заголовку";
    
    // Опис: description (короткий) або content (довгий)
    // Для модалки беремо content, якщо є, інакше description
    let fullText = item.content || item.description || "Опис відсутній";
    
    // Для картки (короткий опис) - беремо заголовок
    // NewsData дає хороші заголовки, їх не треба різати
    let shortTitle = title;
    
    // Якщо заголовок надто довгий (> 60 символів), обріжемо для краси
    if (shortTitle.length > 60) {
        shortTitle = shortTitle.substring(0, 60) + "...";
    }

    // 4. Дата
    let dateStr = "";
    if (item.pubDate) {
        const dateObj = new Date(item.pubDate);
        dateStr = dateObj.toLocaleDateString('uk-UA', { 
            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
        });
    }

    return {
        title: shortTitle,   // Заголовок для картки
        fullTitle: title,    // Повний заголовок для модалки
        full: fullText,      // Текст для модалки
        image: imageSrc,
        video: videoSrc, 
        date: dateStr,
        link: item.link,     // Посилання на оригінал
        source: item.source_id // Назва джерела (напр. pravda)
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
            <div class="card-meta">
                ${newsItem.source} • ${newsItem.date}
            </div>
        </div>
    `;
    container.appendChild(card);
}

// ==========================================
// 🎬 ПЛЕЄР ТА МОДАЛКА
// ==========================================

function openModal(newsItem) {
    const mediaContainer = document.getElementById('media-container');
    mediaContainer.innerHTML = ''; 

    // Логіка відображення медіа
    if (newsItem.video) {
        // Якщо це YouTube (NewsData часто дає YouTube)
        if (newsItem.video.includes('youtube.com') || newsItem.video.includes('youtu.be')) {
             // Спрощена логіка для YouTube - відкриваємо як посилання, бо iframe важко стилізувати в модалці
             const img = document.createElement('img');
             img.className = 'app-image';
             img.src = newsItem.image;
             mediaContainer.appendChild(img);
        } else {
            // Звичайне відео mp4
            const video = document.createElement('video');
            video.className = 'app-video';
            video.src = newsItem.video;
            video.controls = true;
            video.autoplay = true;
            mediaContainer.appendChild(video);
        }
    } else {
        const img = document.createElement('img');
        img.className = 'app-image';
        img.src = newsItem.image;
        mediaContainer.appendChild(img);
    }

    document.getElementById('modal-title').innerText = newsItem.fullTitle; 
    document.getElementById('modal-date').innerText = newsItem.date;
    
    // NewsData іноді дає текст з HTML тегами, тому краще використовувати innerHTML
    // Але треба бути обережним. Для простоти поки innerText
    document.getElementById('modal-text').innerText = newsItem.full;
    
    document.getElementById('modal-link').href = newsItem.link;
    document.getElementById('modal-link').innerText = `Читати на ${newsItem.source} ↗`;

    document.getElementById('news-modal').classList.add('active');
    tg.BackButton.show();
    tg.BackButton.onClick(closeModal);
}

function closeModal() {
    document.getElementById('news-modal').classList.remove('active');
    setTimeout(() => { document.getElementById('media-container').innerHTML = ''; }, 300);
    tg.BackButton.hide();
}
