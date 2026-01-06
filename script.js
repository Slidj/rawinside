const tg = window.Telegram.WebApp;
tg.expand();

// НАЛАШТУВАННЯ
// Впиши сюди юзернейм свого каналу (без @)
// Поки що для тесту стоїть офіційний канал Telegram, щоб ти бачив результат
const CHANNEL_USERNAME = 'telegram'; 

// Сервіс, який перетворює канал на JSON (api.rss2json.com)
const RSS_URL = `https://api.rss2json.com/v1/api.json?rss_url=https://t.me/s/${CHANNEL_USERNAME}`;

// === 1. ЗАВАНТАЖЕННЯ НОВИН ===
async function loadNews() {
    const container = document.getElementById('news-feed');
    container.innerHTML = '<div class="loading">Завантаження новин...</div>';

    try {
        const response = await fetch(RSS_URL);
        const data = await response.json();

        if (data.status === 'ok') {
            container.innerHTML = ''; // Очистити "Завантаження..."
            
            // data.items - це масив постів з каналу
            data.items.forEach(item => {
                // Телеграм віддає картинки і текст в купі HTML, треба їх розділити
                const parsedItem = parseTelegramPost(item);
                
                // Якщо пост порожній (наприклад, просто стікер), пропускаємо
                if (!parsedItem.text && !parsedItem.image) return;

                createCard(parsedItem);
            });
        } else {
            container.innerHTML = '<div class="error">Помилка завантаження каналу</div>';
        }
    } catch (error) {
        console.error(error);
        container.innerHTML = '<div class="error">Немає інтернету або канал закритий</div>';
    }
}

// === 2. РОЗБІР ПОСТА (ПАРСИНГ) ===
// Ця функція витягує чисту картинку і чистий текст з каші, яку віддає RSS
function parseTelegramPost(item) {
    // 1. Шукаємо картинку в content (HTML)
    const imgRegex = /<img[^>]+src="([^">]+)"/;
    const imgMatch = item.description.match(imgRegex);
    let imageSrc = imgMatch ? imgMatch[1] : 'img/default-news.jpg'; // Картинка-заглушка, якщо в пості немає фото

    // 2. Чистимо текст від HTML тегів (<br>, <b> і т.д.) для прев'ю
    let cleanText = item.description.replace(/<[^>]*>?/gm, ''); // Видалити всі теги
    
    // Якщо текст занадто довгий для заголовка, обрізаємо
    let title = item.title;
    if (title.length > 50) title = title.substring(0, 50) + "...";

    // Форматуємо дату
    const dateObj = new Date(item.pubDate);
    const time = dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    return {
        title: title,
        short: cleanText.substring(0, 80) + "...", // Короткий опис для картки
        full: cleanText, // Повний текст
        image: imageSrc,
        date: time,
        link: item.link,
        tag: "NEWS" // Можна міняти логіку тегів
    };
}

// === 3. СТВОРЕННЯ КАРТКИ ===
function createCard(newsItem) {
    const container = document.getElementById('news-feed');
    const card = document.createElement('div');
    card.className = 'news-card';
    
    // При кліку відкриваємо ту саму модалку
    card.onclick = () => openModal(newsItem);

    card.innerHTML = `
        <img src="${newsItem.image}" alt="" class="card-thumb" onerror="this.style.display='none'">
        <div class="card-content">
            <div class="card-title">${newsItem.title}</div>
            <p class="card-desc">${newsItem.short}</p>
            <span class="card-time">${newsItem.date}</span>
        </div>
    `;
    container.appendChild(card);
}

// === 4. МОДАЛЬНЕ ВІКНО (Те саме, що було) ===
function openModal(newsItem) {
    document.getElementById('modal-img').src = newsItem.image;
    // Якщо картинки немає, ховаємо блок картинки в модалці
    document.getElementById('modal-img').style.display = newsItem.image.includes('default') ? 'none' : 'block';
    
    document.getElementById('modal-tag').innerText = newsItem.tag;
    document.getElementById('modal-date').innerText = newsItem.date;
    document.getElementById('modal-title').innerText = newsItem.title;
    document.getElementById('modal-text').innerText = newsItem.full;
    document.getElementById('modal-link').href = newsItem.link;

    document.getElementById('news-modal').classList.add('active');
    tg.HapticFeedback.impactOccurred('light');
    tg.BackButton.show();
    tg.BackButton.onClick(closeModal);
}

function closeModal() {
    document.getElementById('news-modal').classList.remove('active');
    tg.BackButton.hide();
}

// Запуск
loadNews();

// Дата в шапці
const options = { weekday: 'long', month: 'long', day: 'numeric' };
document.getElementById('current-date').innerText = new Date().toLocaleDateString('uk-UA', options);
