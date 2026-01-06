const tg = window.Telegram.WebApp;
tg.expand();

// Налаштування кольорів під тему Телеграм
if (tg.colorScheme === 'light') {
    document.body.style.backgroundColor = '#ffffff';
    document.body.style.color = '#000000';
}

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

// Впиши сюди юзернейм твого ПУБЛІЧНОГО каналу (без @ і посилань)
// Спробуй спочатку залишити 'telegram', щоб переконатись, що код працює
const CHANNEL_USERNAME = 'telegram'; 

// Використовуємо OpenRSS як міст, бо напряму Телеграм часто блокує запити
const RSS_URL = `https://api.rss2json.com/v1/api.json?rss_url=https://openrss.org/t.me/${CHANNEL_USERNAME}`;

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ НОВИН
// ==========================================

async function loadNews() {
    const container = document.getElementById('news-feed');
    container.innerHTML = '<div class="loading">🔄 Завантаження стрічки...</div>';

    try {
        const response = await fetch(RSS_URL);
        const data = await response.json();

        // Перевірка, чи все ок
        if (data.status === 'ok') {
            container.innerHTML = ''; // Очищаємо статус завантаження
            
            // Проходимось по кожному посту
            data.items.forEach(item => {
                const parsedItem = parseTelegramPost(item);
                // Показуємо тільки якщо є картинка або текст
                if (parsedItem) {
                    createCard(parsedItem);
                }
            });
        } else {
            // Якщо помилка API
            container.innerHTML = `
                <div class="error" style="text-align:center; padding:20px; color:#ef4444;">
                    <h3>Помилка доступу 😔</h3>
                    <p>Не вдалося отримати дані з каналу <b>@${CHANNEL_USERNAME}</b>.</p>
                    <p><small>Деталі: ${data.message}</small></p>
                </div>
            `;
        }
    } catch (error) {
        // Якщо немає інтернету або посилання бите
        console.error(error);
        container.innerHTML = `
            <div class="error" style="text-align:center; padding:20px; color:#ef4444;">
                <h3>Помилка мережі 🌐</h3>
                <p>Перевір інтернет або налаштування каналу.</p>
            </div>
        `;
    }
}

// ==========================================
// 🧠 ОБРОБКА ДАНИХ (ПАРСИНГ)
// ==========================================

function parseTelegramPost(item) {
    // 1. Шукаємо картинку в описі (HTML)
    // OpenRSS зазвичай дає картинку в тезі <figure> або <img>
    const imgRegex = /src="([^"]+)"/;
    const imgMatch = item.description.match(imgRegex);
    
    // Якщо картинки немає, ставимо заглушку (можеш змінити на своє посилання)
    let imageSrc = imgMatch ? imgMatch[1] : 'https://placehold.co/600x400/1c1c1e/FFF?text=No+Image';

    // 2. Чистимо текст від HTML (прибираємо <br>, <b>, посилання і т.д.) для прев'ю
    // Створюємо тимчасовий елемент, щоб браузер сам почистив текст
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = item.description;
    let cleanText = tempDiv.innerText || tempDiv.textContent || "";
    
    // Видаляємо зайві пробіли
    cleanText = cleanText.trim();

    // Якщо пост порожній (наприклад, тільки картинка без підпису), даємо дефолтний текст
    if (!cleanText && !imgMatch) return null; // Пропускаємо пусті пости
    if (!cleanText) cleanText = "Дивись фото в повному описі...";

    // 3. Форматуємо дату
    const dateObj = new Date(item.pubDate);
    const dateStr = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
    const timeStr = dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    return {
        title: item.title && item.title.length < 50 ? item.title : "Новина з каналу",
        short: cleanText.substring(0, 100) + (cleanText.length > 100 ? "..." : ""),
        full: cleanText,
        image: imageSrc,
        date: `${dateStr}, ${timeStr}`,
        link: item.link,
        tag: "NEWS"
    };
}

// ==========================================
// 🎨 СТВОРЕННЯ ІНТЕРФЕЙСУ
// ==========================================

function createCard(newsItem) {
    const container = document.getElementById('news-feed');
    const card = document.createElement('div');
    card.className = 'news-card';
    
    // При кліку відкриваємо модалку
    card.onclick = () => openModal(newsItem);

    card.innerHTML = `
        <img src="${newsItem.image}" alt="" class="card-thumb" onerror="this.src='https://placehold.co/100?text=Error'">
        <div class="card-content">
            <div class="card-title">${newsItem.title}</div>
            <p class="card-desc">${newsItem.short}</p>
            <span class="card-time">${newsItem.date}</span>
        </div>
    `;
    container.appendChild(card);
}

// ==========================================
// 📱 МОДАЛЬНЕ ВІКНО (Full Screen)
// ==========================================

function openModal(newsItem) {
    const modalImg = document.getElementById('modal-img');
    
    // Встановлюємо дані
    modalImg.src = newsItem.image;
    document.getElementById('modal-tag').innerText = newsItem.tag;
    document.getElementById('modal-date').innerText = newsItem.date;
    document.getElementById('modal-title').innerText = newsItem.title;
    document.getElementById('modal-text').innerText = newsItem.full;
    document.getElementById('modal-link').href = newsItem.link;

    // Показуємо вікно
    document.getElementById('news-modal').classList.add('active');
    
    // Вібрація
    tg.HapticFeedback.impactOccurred('light');
    
    // Налаштовуємо кнопку "Назад" в самому Телеграмі
    tg.BackButton.show();
    tg.BackButton.onClick(closeModal);
}

function closeModal() {
    document.getElementById('news-modal').classList.remove('active');
    tg.BackButton.hide();
    // Вимикаємо обробник, щоб не дублювався
    tg.BackButton.offClick(closeModal);
}

// ==========================================
// 🚀 ЗАПУСК
// ==========================================

// Встановлюємо дату в шапці
const options = { weekday: 'long', month: 'long', day: 'numeric' };
const today = new Date().toLocaleDateString('uk-UA', options);
// Робимо першу літеру великою (Понеділок замість понеділок)
document.getElementById('current-date').innerText = today.charAt(0).toUpperCase() + today.slice(1);

// Завантажуємо новини
loadNews();
