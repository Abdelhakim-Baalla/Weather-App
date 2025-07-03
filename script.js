class WeatherVibeApp {
    constructor() {
        this.apiKey = '67d6c2aad687c51529580e71e4871fe0'; // Remplacez par votre vraie clé API
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
        this.geoUrl = 'https://api.openweathermap.org/geo/1.0';
        this.currentWeatherData = null;
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.temperatureChart = null;
        this.precipitationChart = null;
        this.init();
    }

    init() {
        this.setupTheme();
        this.bindEvents();
        this.initializeCharts();
        this.loadDefaultWeather();
        this.updateCurrentTime();
        setInterval(() => this.updateCurrentTime(), 60000); // Update every minute
    }

    setupTheme() {
        if (this.isDarkMode) {
            document.documentElement.classList.add('dark');
            document.querySelector('#themeToggle i').className = 'fas fa-sun';
        } else {
            document.documentElement.classList.remove('dark');
            document.querySelector('#themeToggle i').className = 'fas fa-moon';
        }
    }

    bindEvents() {
        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => this.searchWeather());
        document.getElementById('cityInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchWeather();
        });
        
        // Location and refresh
        document.getElementById('locationBtn').addEventListener('click', () => this.getCurrentLocation());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshWeather());
        document.getElementById('retryBtn').addEventListener('click', () => this.loadDefaultWeather());
        
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // Share functionality
        document.getElementById('shareBtn').addEventListener('click', () => this.openShareModal());
        document.getElementById('closeShareModal').addEventListener('click', () => this.closeShareModal());
        
        // Share buttons
        document.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleShare(e.target.closest('.share-btn').dataset.platform));
        });
        
        // Quick city buttons
        document.querySelectorAll('.quick-city-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.searchCity(e.target.dataset.city));
        });
        
        // Close modal on outside click
        document.getElementById('shareModal').addEventListener('click', (e) => {
            if (e.target.id === 'shareModal') this.closeShareModal();
        });
    }

    updateCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.textContent = timeString;
        }
    }

    async loadDefaultWeather() {
        try {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const { latitude, longitude } = position.coords;
                        await this.getWeatherByCoords(latitude, longitude);
                    },
                    async () => {
                        await this.searchCity('Paris');
                    },
                    { timeout: 5000 }
                );
            } else {
                await this.searchCity('Paris');
            }
        } catch (error) {
            console.error('Error loading default weather:', error);
            await this.searchCity('Paris');
        }
    }

    async searchWeather() {
        const cityInput = document.getElementById('cityInput');
        const city = cityInput.value.trim();
        
        if (!city) {
            this.showToast('Veuillez entrer le nom d\'une ville', 'error');
            return;
        }

        await this.searchCity(city);
    }

    async searchCity(cityName) {
        this.showLoading();
        
        try {
            // Géocodage pour obtenir les coordonnées
            const geoResponse = await fetch(
                `${this.geoUrl}/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${this.apiKey}`
            );
            
            if (!geoResponse.ok) {
                throw new Error('Erreur de géocodage');
            }
            
            const geoData = await geoResponse.json();
            
            if (geoData.length === 0) {
                throw new Error('Ville non trouvée');
            }
            
            const { lat, lon } = geoData[0];
            await this.getWeatherByCoords(lat, lon);
            
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Ville non trouvée. Veuillez vérifier l\'orthographe.');
        }
        
        this.hideLoading();
    }

    async getCurrentLocation() {
        if (!navigator.geolocation) {
            this.showToast('La géolocalisation n\'est pas supportée', 'error');
            return;
        }

        this.showLoading();

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                await this.getWeatherByCoords(latitude, longitude);
            },
            (error) => {
                this.hideLoading();
                let errorMessage = 'Impossible d\'obtenir votre position';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Accès à la géolocalisation refusé';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Position non disponible';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Délai d\'attente dépassé';
                        break;
                }
                this.showToast(errorMessage, 'error');
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    }

    async refreshWeather() {
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.style.animation = 'rotateSlow 1s linear';
        
        if (this.currentWeatherData) {
            const { coord } = this.currentWeatherData;
            await this.getWeatherByCoords(coord.lat, coord.lon);
        } else {
            await this.loadDefaultWeather();
        }
        
        setTimeout(() => {
            refreshBtn.style.animation = '';
        }, 1000);
    }

    async getWeatherByCoords(lat, lon) {
        this.showLoading();
        
        try {
            // Données météo actuelles
            const currentResponse = await fetch(
                `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&lang=fr`
            );
            
            if (!currentResponse.ok) {
                throw new Error(`HTTP error! status: ${currentResponse.status}`);
            }
            
            const currentData = await currentResponse.json();
            
            // Prévisions 5 jours
            const forecastResponse = await fetch(
                `${this.baseUrl}/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&lang=fr`
            );
            
            if (!forecastResponse.ok) {
                throw new Error(`HTTP error! status: ${forecastResponse.status}`);
            }
            
            const forecastData = await forecastResponse.json();
            
            // Stocker les données actuelles
            this.currentWeatherData = currentData;
            
            // Afficher toutes les données
            this.displayCurrentWeather(currentData);
            this.displayHourlyForecast(forecastData.list.slice(0, 12));
            this.displayWeeklyForecast(this.processWeeklyForecast(forecastData.list));
            this.updateCharts(forecastData.list.slice(0, 8)); // 24 heures de données
            
            this.showWeatherDisplay();
            this.showToast('Données météo mises à jour', 'success');
            
        } catch (error) {
            console.error('Weather fetch error:', error);
            this.showError('Impossible d\'obtenir les données météo. Veuillez réessayer.');
        }
        
        this.hideLoading();
    }

    displayCurrentWeather(data) {
        const sunrise = new Date(data.sys.sunrise * 1000);
        const sunset = new Date(data.sys.sunset * 1000);
        
        // Informations principales
        document.getElementById('cityName').textContent = data.name;
        document.getElementById('country').textContent = data.sys.country;
        document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}°`;
        document.getElementById('description').textContent = data.weather[0].description;
        document.getElementById('feelsLike').textContent = `Ressenti ${Math.round(data.main.feels_like)}°C`;
        document.getElementById('tempRange').textContent = `Min ${Math.round(data.main.temp_min)}° • Max ${Math.round(data.main.temp_max)}°`;
        
        // Statistiques détaillées
        document.getElementById('humidity').textContent = `${data.main.humidity}%`;
        document.getElementById('pressure').textContent = data.main.pressure;
        document.getElementById('visibility').textContent = `${(data.visibility / 1000).toFixed(1)} km`;
        document.getElementById('windSpeed').textContent = `${Math.round(data.wind.speed * 3.6)} km/h`;
        document.getElementById('windDirection').textContent = this.getWindDirection(data.wind.deg || 0);
        document.getElementById('sunrise').textContent = sunrise.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('sunset').textContent = sunset.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        // Mettre à jour l'icône météo avec animation
        const weatherIcon = document.getElementById('weatherIcon');
        const iconInfo = this.getWeatherIconInfo(data.weather[0].main);
        weatherIcon.innerHTML = `<i class="${iconInfo.class} ${iconInfo.color}"></i>`;

        // Mettre à jour la barre d'humidité avec animation
        const humidityBar = document.getElementById('humidityBar');
        setTimeout(() => {
            humidityBar.style.width = `${data.main.humidity}%`;
        }, 500);
    }

    displayHourlyForecast(hourlyData) {
        const container = document.getElementById('hourlyForecast');
        container.innerHTML = '';

        hourlyData.forEach((hour, index) => {
            const time = new Date(hour.dt * 1000);
            const hourItem = document.createElement('div');
            hourItem.className = 'hourly-item';
            hourItem.style.animationDelay = `${index * 0.1}s`;
            
            const iconInfo = this.getWeatherIconInfo(hour.weather[0].main);
            
            hourItem.innerHTML = `
                <div class="text-sm text-white/70 mb-3">${time.getHours().toString().padStart(2, '0')}:00</div>
                <div class="text-3xl ${iconInfo.color} mb-3">
                    <i class="${iconInfo.class}"></i>
                </div>
                <div class="text-lg font-bold text-white mb-2">${Math.round(hour.main.temp)}°</div>
                <div class="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">
                    ${Math.round((hour.pop || 0) * 100)}%
                </div>
            `;
            
            container.appendChild(hourItem);
        });
    }

    processWeeklyForecast(forecastList) {
        const dailyData = {};
        
        forecastList.forEach(item => {
            const date = new Date(item.dt * 1000);
            const dateKey = date.toDateString();
            
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                    date: date,
                    temps: [],
                    weather: item.weather[0],
                    precipitation: item.pop || 0
                };
            }
            
            dailyData[dateKey].temps.push(item.main.temp);
            dailyData[dateKey].precipitation = Math.max(dailyData[dateKey].precipitation, item.pop || 0);
        });
        
        return Object.values(dailyData).slice(0, 7).map(day => ({
            date: day.date,
            temp_max: Math.round(Math.max(...day.temps)),
            temp_min: Math.round(Math.min(...day.temps)),
            weather: day.weather,
            precipitation: Math.round(day.precipitation * 100)
        }));
    }

    displayWeeklyForecast(weeklyData) {
        const container = document.getElementById('weeklyForecast');
        container.innerHTML = '';

        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

        weeklyData.forEach((day, index) => {
            const dayItem = document.createElement('div');
            dayItem.className = 'daily-item';
            dayItem.style.animationDelay = `${index * 0.1}s`;
            
            const dayName = index === 0 ? 'Aujourd\'hui' : days[day.date.getDay()];
            const iconInfo = this.getWeatherIconInfo(day.weather.main);
            
            dayItem.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <div class="text-center min-w-[80px]">
                            <div class="text-sm font-semibold text-white">${dayName}</div>
                            <div class="text-xs text-white/60">${day.date.getDate()}/${day.date.getMonth() + 1}</div>
                        </div>
                        <div class="text-3xl ${iconInfo.color}">
                            <i class="${iconInfo.class}"></i>
                        </div>
                        <div class="text-sm text-white/80 capitalize flex-1">${day.weather.description}</div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <div class="text-xs text-blue-400 bg-blue-500/20 px-3 py-1 rounded-full">
                            <i class="fas fa-cloud-rain mr-1"></i>${day.precipitation}%
                        </div>
                        <div class="text-right min-w-[60px]">
                            <div class="text-xl font-bold text-white">${day.temp_max}°</div>
                            <div class="text-sm text-white/60">${day.temp_min}°</div>
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(dayItem);
        });
    }

    initializeCharts() {
        // Configuration commune pour les graphiques
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.8)' }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.8)' }
                }
            },
            elements: {
                point: { radius: 4, hoverRadius: 6 }
            }
        };

        // Graphique de température
        const tempCtx = document.getElementById('temperatureChart').getContext('2d');
        this.temperatureChart = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Température (°C)',
                    data: [],
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        beginAtZero: false
                    }
                }
            }
        });

        // Graphique de précipitations
        const precipCtx = document.getElementById('precipitationChart').getContext('2d');
        this.precipitationChart = new Chart(precipCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Précipitations (%)',
                    data: [],
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    updateCharts(forecastData) {
        if (!this.temperatureChart || !this.precipitationChart) return;

        const labels = forecastData.map(item => {
            const date = new Date(item.dt * 1000);
            return date.getHours().toString().padStart(2, '0') + ':00';
        });
        
        const temperatures = forecastData.map(item => Math.round(item.main.temp));
        const precipitation = forecastData.map(item => Math.round((item.pop || 0) * 100));
        
        // Mise à jour du graphique de température
        this.temperatureChart.data.labels = labels;
        this.temperatureChart.data.datasets[0].data = temperatures;
        this.temperatureChart.update('none'); // Animation désactivée pour éviter les boucles
        
        // Mise à jour du graphique de précipitations
        this.precipitationChart.data.labels = labels;
        this.precipitationChart.data.datasets[0].data = precipitation;
        this.precipitationChart.update('none'); // Animation désactivée pour éviter les boucles
    }

    getWeatherIconInfo(weatherMain) {
        const iconMap = {
            'Clear': { class: 'fas fa-sun', color: 'text-yellow-400 weather-sunny' },
            'Clouds': { class: 'fas fa-cloud', color: 'text-gray-300 weather-cloudy' },
            'Rain': { class: 'fas fa-cloud-rain', color: 'text-blue-400 weather-rainy' },
            'Snow': { class: 'fas fa-snowflake', color: 'text-white weather-snowy' },
            'Thunderstorm': { class: 'fas fa-bolt', color: 'text-purple-400' },
            'Drizzle': { class: 'fas fa-cloud-drizzle', color: 'text-blue-300' },
            'Mist': { class: 'fas fa-smog', color: 'text-gray-400' },
            'Fog': { class: 'fas fa-smog', color: 'text-gray-400' }
        };
        
        return iconMap[weatherMain] || iconMap['Clear'];
    }

    getWindDirection(degrees) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index];
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        const themeIcon = document.querySelector('#themeToggle i');
        
        if (this.isDarkMode) {
            document.documentElement.classList.add('dark');
            themeIcon.className = 'fas fa-sun';
        } else {
            document.documentElement.classList.remove('dark');
            themeIcon.className = 'fas fa-moon';
        }
        
        localStorage.setItem('darkMode', this.isDarkMode);
        this.showToast(`Mode ${this.isDarkMode ? 'sombre' : 'clair'} activé`, 'info');
    }

    openShareModal() {
        document.getElementById('shareModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeShareModal() {
        document.getElementById('shareModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    async handleShare(platform) {
        if (!this.currentWeatherData) {
            this.showToast('Aucune donnée météo à partager', 'error');
            return;
        }

        const { name, main, weather } = this.currentWeatherData;
        const temp = Math.round(main.temp);
        const description = weather[0].description;
        
        const shareText = `🌤️ Météo à ${name}: ${temp}°C, ${description}. Découvrez plus sur WeatherVibe!`;
        const shareUrl = window.location.href;

        switch (platform) {
            case 'twitter':
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
                break;
            case 'facebook':
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank');
                break;
            case 'whatsapp':
                window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank');
                break;
            case 'copy':
                try {
                    await navigator.clipboard.writeText(shareText + ' ' + shareUrl);
                    this.showToast('Lien copié dans le presse-papiers', 'success');
                } catch (error) {
                    this.showToast('Impossible de copier le lien', 'error');
                }
                break;
        }

        this.closeShareModal();
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('weatherDisplay').classList.add('hidden');
        document.getElementById('errorMessage').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showWeatherDisplay() {
        document.getElementById('weatherDisplay').classList.remove('hidden');
        document.getElementById('errorMessage').classList.add('hidden');
    }

    showError(message) {
        document.getElementById('errorText').textContent = message;
        document.getElementById('errorMessage').classList.remove('hidden');
        document.getElementById('weatherDisplay').classList.add('hidden');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle text-green-400',
            error: 'fas fa-exclamation-triangle text-red-400',
            info: 'fas fa-info-circle text-blue-400'
        };
        
        toast.innerHTML = `
            <div class="flex items-center space-x-3">
                <i class="${icons[type]}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.getElementById('toastContainer').appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
    new WeatherVibeApp();
});

// Gestion des erreurs globales
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});