class WeatherApp {
  constructor() {
    this.apiKey = typeof API_KEY !== "undefined" ? API_KEY : ""; // Utilise la clé API depuis config.js
    this.baseUrl = "https://api.openweathermap.org/data/2.5";
    this.geoUrl = "https://api.openweathermap.org/geo/1.0";
    this.currentWeatherData = null;
    this.isDarkMode = localStorage.getItem("darkMode") === "true";
    this.favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
    this.temperatureChart = null;
    this.precipitationChart = null;
    this.lastUpdate = null;
    this.notifications = [];
    this.isVoiceSupported =
      "webkitSpeechRecognition" in window || "SpeechRecognition" in window;

    this.init();
  }

  init() {
    this.setupTheme();
    this.bindEvents();
    this.initializeCharts();
    this.loadDefaultWeather();
    this.updateCurrentTime();
    this.setupScrollToTop();

    // Update time every minute
    setInterval(() => this.updateCurrentTime(), 60000);

    // Auto-refresh weather data every 10 minutes
    setInterval(() => this.autoRefreshWeather(), 10 * 60 * 1000);
  }

  setupTheme() {
    const body = document.body;
    const themeIcon = document.querySelector("#themeToggle i");

    if (this.isDarkMode) {
      body.classList.add("dark-theme");
      body.classList.remove("light-theme");
      themeIcon.className = "fas fa-sun";
    } else {
      body.classList.add("light-theme");
      body.classList.remove("dark-theme");
      themeIcon.className = "fas fa-moon";
    }
  }

  bindEvents() {
    // Search functionality
    document
      .getElementById("searchBtn")
      .addEventListener("click", () => this.searchWeather());
    document.getElementById("cityInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.searchWeather();
    });

    // Control buttons
    document
      .getElementById("locationBtn")
      .addEventListener("click", () => this.getCurrentLocation());
    document
      .getElementById("refreshBtn")
      .addEventListener("click", () => this.refreshWeather());
    document
      .getElementById("retryBtn")
      .addEventListener("click", () => this.loadDefaultWeather());
    document
      .getElementById("voiceBtn")
      .addEventListener("click", () => this.startVoiceSearch());
    document
      .getElementById("favoriteBtn")
      .addEventListener("click", () => this.toggleFavorite());
    document
      .getElementById("favoritesBtn")
      .addEventListener("click", () => this.showFavorites());
    document
      .getElementById("notificationBtn")
      .addEventListener("click", () => this.showNotifications());
    document
      .getElementById("shareBtn")
      .addEventListener("click", () => this.openShareModal());
    document
      .getElementById("themeToggle")
      .addEventListener("click", () => this.toggleTheme());

    // Modal events
    document
      .getElementById("closeShareModal")
      .addEventListener("click", () => this.closeShareModal());
    document
      .getElementById("closeAlertModal")
      .addEventListener("click", () => this.closeAlertModal());

    // Share buttons
    document.querySelectorAll(".share-btn").forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.handleShare(e.target.closest(".share-btn").dataset.platform)
      );
    });

    // Quick city buttons
    document.querySelectorAll(".quick-city").forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.searchCity(e.target.dataset.city)
      );
    });

    // Scroll to top
    document.getElementById("scrollTopBtn").addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Modal overlay clicks
    document.getElementById("shareModal").addEventListener("click", (e) => {
      if (e.target.id === "shareModal") this.closeShareModal();
    });

    document.getElementById("alertModal").addEventListener("click", (e) => {
      if (e.target.id === "alertModal") this.closeAlertModal();
    });
  }

  setupScrollToTop() {
    const scrollTopBtn = document.getElementById("scrollTopBtn");

    window.addEventListener("scroll", () => {
      if (window.scrollY > 300) {
        scrollTopBtn.classList.add("visible");
      } else {
        scrollTopBtn.classList.remove("visible");
      }
    });
  }

  updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const timeElement = document.getElementById("currentTime");
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
            await this.searchCity("Paris");
          },
          { timeout: 5000 }
        );
      } else {
        await this.searchCity("Paris");
      }
    } catch (error) {
      console.error("Error loading default weather:", error);
      await this.searchCity("Paris");
    }
  }

  async searchWeather() {
    const cityInput = document.getElementById("cityInput");
    const city = cityInput.value.trim();

    if (!city) {
      this.showToast("Please enter a city name", "error");
      return;
    }

    await this.searchCity(city);
  }

  async searchCity(cityName) {
    this.showLoading();

    try {
      const geoResponse = await fetch(
        `${this.geoUrl}/direct?q=${encodeURIComponent(
          cityName
        )}&limit=1&appid=${this.apiKey}`
      );

      if (!geoResponse.ok) {
        throw new Error("Geocoding error");
      }

      const geoData = await geoResponse.json();

      if (geoData.length === 0) {
        throw new Error("City not found");
      }

      const { lat, lon } = geoData[0];
      await this.getWeatherByCoords(lat, lon);
    } catch (error) {
      console.error("Search error:", error);
      this.showError(
        "City not found. Please check the spelling and try again."
      );
    }

    this.hideLoading();
  }

  async getCurrentLocation() {
    if (!navigator.geolocation) {
      this.showToast("Geolocation is not supported", "error");
      return;
    }

    this.showLoading();
    const locationBtn = document.getElementById("locationBtn");
    const originalIcon = locationBtn.querySelector("i").className;
    locationBtn.querySelector("i").className = "fas fa-spinner fa-spin";

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await this.getWeatherByCoords(latitude, longitude);
        locationBtn.querySelector("i").className = originalIcon;
      },
      (error) => {
        this.hideLoading();
        locationBtn.querySelector("i").className = originalIcon;

        let errorMessage = "Unable to get your location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timeout";
            break;
        }
        this.showToast(errorMessage, "error");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  async refreshWeather() {
    const refreshBtn = document.getElementById("refreshBtn");
    const originalIcon = refreshBtn.querySelector("i").className;
    refreshBtn.querySelector("i").className = "fas fa-spinner fa-spin";

    if (this.currentWeatherData) {
      const { coord } = this.currentWeatherData;
      await this.getWeatherByCoords(coord.lat, coord.lon);
    } else {
      await this.loadDefaultWeather();
    }

    setTimeout(() => {
      refreshBtn.querySelector("i").className = originalIcon;
    }, 1000);
  }

  async autoRefreshWeather() {
    if (this.currentWeatherData) {
      const { coord } = this.currentWeatherData;
      await this.getWeatherByCoords(coord.lat, coord.lon, true);
    }
  }

  async getWeatherByCoords(lat, lon, isAutoRefresh = false) {
    if (!isAutoRefresh) {
      this.showLoading();
    }

    try {
      // Current weather
      const currentResponse = await fetch(
        `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`
      );

      if (!currentResponse.ok) {
        throw new Error(`HTTP error! status: ${currentResponse.status}`);
      }

      const currentData = await currentResponse.json();

      // 5-day forecast
      const forecastResponse = await fetch(
        `${this.baseUrl}/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`
      );

      if (!forecastResponse.ok) {
        throw new Error(`HTTP error! status: ${forecastResponse.status}`);
      }

      const forecastData = await forecastResponse.json();

      this.currentWeatherData = currentData;
      this.lastUpdate = new Date();

      this.displayCurrentWeather(currentData);
      this.displayHourlyForecast(forecastData.list.slice(0, 12));
      this.displayWeeklyForecast(this.processWeeklyForecast(forecastData.list));
      this.updateCharts(forecastData.list.slice(0, 8));
      this.generateWeatherInsights(currentData, forecastData);

      this.showWeatherDisplay();

      if (!isAutoRefresh) {
        this.showToast("Weather data updated successfully", "success");
      }
    } catch (error) {
      console.error("Weather fetch error:", error);
      if (!isAutoRefresh) {
        this.showError("Unable to fetch weather data. Please try again.");
      }
    }

    if (!isAutoRefresh) {
      this.hideLoading();
    }
  }

  displayCurrentWeather(data) {
    const sunrise = new Date(data.sys.sunrise * 1000);
    const sunset = new Date(data.sys.sunset * 1000);

    // Main information
    document.getElementById("cityName").textContent = data.name;
    document.getElementById("countryName").textContent = data.sys.country;
    document.getElementById("mainTemperature").textContent = `${Math.round(
      data.main.temp
    )}°`;
    document.getElementById("weatherDescription").textContent =
      data.weather[0].description;
    document.getElementById("feelsLike").textContent = `Feels like ${Math.round(
      data.main.feels_like
    )}°C`;
    document.getElementById("tempRange").textContent = `H: ${Math.round(
      data.main.temp_max
    )}° L: ${Math.round(data.main.temp_min)}°`;

    // Weather stats
    document.getElementById("humidity").textContent = `${data.main.humidity}%`;
    document.getElementById(
      "pressure"
    ).textContent = `${data.main.pressure} hPa`;
    document.getElementById("visibility").textContent = `${(
      data.visibility / 1000
    ).toFixed(1)} km`;
    document.getElementById("windSpeed").textContent = `${Math.round(
      data.wind.speed * 3.6
    )} km/h`;
    document.getElementById("windDirection").textContent =
      this.getWindDirection(data.wind.deg || 0);
    document.getElementById("uvIndex").textContent = "5"; // Default value as UV index is not in basic API
    document.getElementById("precipitation").textContent = "20%"; // Default value

    // Sun times
    document.getElementById("sunrise").textContent = sunrise.toLocaleTimeString(
      "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
    document.getElementById("sunset").textContent = sunset.toLocaleTimeString(
      "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );

    // Update weather icon
    const weatherIcon = document.getElementById("weatherIcon");
    const iconInfo = this.getWeatherIconInfo(
      data.weather[0].main,
      data.weather[0].icon
    );
    weatherIcon.innerHTML = `<i class="${iconInfo.class} ${iconInfo.color}"></i>`;

    // Update humidity bar
    const humidityBar = document.getElementById("humidityBar");
    setTimeout(() => {
      humidityBar.style.width = `${data.main.humidity}%`;
    }, 500);

    // Update favorite button state
    this.updateFavoriteButton(data.name, data.sys.country);
  }

  displayHourlyForecast(hourlyData) {
    const container = document.getElementById("hourlyForecast");
    container.innerHTML = "";

    hourlyData.forEach((hour, index) => {
      const time = new Date(hour.dt * 1000);
      const hourItem = document.createElement("div");
      hourItem.className = "hourly-item";

      const iconInfo = this.getWeatherIconInfo(
        hour.weather[0].main,
        hour.weather[0].icon
      );

      hourItem.innerHTML = `
                <div class="hourly-time">
                    ${time.getHours().toString().padStart(2, "0")}:00
                </div>
                <div class="hourly-icon ${iconInfo.color}">
                    <i class="${iconInfo.class}"></i>
                </div>
                <div class="hourly-temp">
                    ${Math.round(hour.main.temp)}°
                </div>
                <div class="hourly-desc">
                    ${hour.weather[0].description}
                </div>
            `;

      container.appendChild(hourItem);
    });
  }

  processWeeklyForecast(forecastList) {
    const dailyData = {};

    forecastList.forEach((item) => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();

      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: date,
          temps: [],
          weather: item.weather[0],
          precipitation: item.pop || 0,
          wind: item.wind.speed,
          humidity: item.main.humidity,
        };
      }

      dailyData[dateKey].temps.push(item.main.temp);
      dailyData[dateKey].precipitation = Math.max(
        dailyData[dateKey].precipitation,
        item.pop || 0
      );
    });

    return Object.values(dailyData)
      .slice(0, 7)
      .map((day) => ({
        date: day.date,
        temp_max: Math.round(Math.max(...day.temps)),
        temp_min: Math.round(Math.min(...day.temps)),
        weather: day.weather,
        precipitation: Math.round(day.precipitation * 100),
        wind: Math.round(day.wind * 3.6),
        humidity: Math.round(day.humidity),
      }));
  }

  displayWeeklyForecast(weeklyData) {
    const container = document.getElementById("weeklyForecast");
    container.innerHTML = "";

    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    weeklyData.forEach((day, index) => {
      const dayItem = document.createElement("div");
      dayItem.className = "weekly-item";

      const dayName = index === 0 ? "Today" : days[day.date.getDay()];
      const iconInfo = this.getWeatherIconInfo(
        day.weather.main,
        day.weather.icon
      );

      dayItem.innerHTML = `
                <div class="weekly-day">
                    <div class="weekly-day-name">${dayName}</div>
                    <div class="weekly-day-date">${day.date.getDate()}/${
        day.date.getMonth() + 1
      }</div>
                </div>
                <div class="weekly-icon ${iconInfo.color}">
                    <i class="${iconInfo.class}"></i>
                </div>
                <div class="weekly-desc">
                    ${day.weather.description}
                </div>
                <div class="weekly-temps">
                    <span class="weekly-high">${day.temp_max}°</span>
                    <span class="weekly-low">${day.temp_min}°</span>
                </div>
            `;

      container.appendChild(dayItem);
    });
  }

  initializeCharts() {
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleColor: "white",
          bodyColor: "white",
          borderColor: "rgba(255, 255, 255, 0.2)",
          borderWidth: 1,
          cornerRadius: 10,
          padding: 12,
        },
      },
      scales: {
        y: {
          grid: { color: "rgba(148, 163, 184, 0.2)" },
          ticks: { color: "rgba(148, 163, 184, 0.8)", font: { size: 12 } },
          border: { display: false },
        },
        x: {
          grid: { color: "rgba(148, 163, 184, 0.2)" },
          ticks: { color: "rgba(148, 163, 184, 0.8)", font: { size: 12 } },
          border: { display: false },
        },
      },
      elements: {
        point: { radius: 6, hoverRadius: 8 },
      },
    };

    // Temperature chart
    const tempCtx = document
      .getElementById("temperatureChart")
      .getContext("2d");
    this.temperatureChart = new Chart(tempCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Temperature (°C)",
            data: [],
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointBackgroundColor: "#3b82f6",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            beginAtZero: false,
          },
        },
      },
    });

    // Precipitation chart
    const precipCtx = document
      .getElementById("precipitationChart")
      .getContext("2d");
    this.precipitationChart = new Chart(precipCtx, {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          {
            label: "Precipitation (%)",
            data: [],
            backgroundColor: "rgba(139, 92, 246, 0.8)",
            borderColor: "#8b5cf6",
            borderWidth: 1,
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            beginAtZero: true,
            max: 100,
          },
        },
      },
    });
  }

  updateCharts(forecastData) {
    if (!this.temperatureChart || !this.precipitationChart) return;

    const labels = forecastData.map((item) => {
      const date = new Date(item.dt * 1000);
      return date.getHours().toString().padStart(2, "0") + ":00";
    });

    const temperatures = forecastData.map((item) => Math.round(item.main.temp));
    const precipitation = forecastData.map((item) =>
      Math.round((item.pop || 0) * 100)
    );

    // Update temperature chart
    this.temperatureChart.data.labels = labels;
    this.temperatureChart.data.datasets[0].data = temperatures;
    this.temperatureChart.update("none");

    // Update precipitation chart
    this.precipitationChart.data.labels = labels;
    this.precipitationChart.data.datasets[0].data = precipitation;
    this.precipitationChart.update("none");
  }

  generateWeatherInsights(currentData, forecastData) {
    const insights = [];
    const temp = currentData.main.temp;
    const humidity = currentData.main.humidity;
    const windSpeed = currentData.wind.speed * 3.6;
    const weather = currentData.weather[0].main;

    // Temperature insights
    if (temp > 25) {
      insights.push({
        icon: "fas fa-sun",
        color: "#f59e0b",
        title: "Perfect for outdoor activities",
        description:
          "Great weather for swimming, hiking, or enjoying outdoor dining",
      });
    } else if (temp < 5) {
      insights.push({
        icon: "fas fa-snowflake",
        color: "#3b82f6",
        title: "Bundle up!",
        description: "Cold weather ahead. Dress warmly and stay cozy indoors",
      });
    } else {
      insights.push({
        icon: "fas fa-leaf",
        color: "#22c55e",
        title: "Pleasant weather",
        description:
          "Perfect temperature for a comfortable walk or outdoor activities",
      });
    }

    // Humidity insights
    if (humidity > 80) {
      insights.push({
        icon: "fas fa-tint",
        color: "#3b82f6",
        title: "High humidity",
        description: "The air might feel heavy and muggy. Stay hydrated!",
      });
    }

    // Wind insights
    if (windSpeed > 20) {
      insights.push({
        icon: "fas fa-wind",
        color: "#6b7280",
        title: "Windy conditions",
        description:
          "Strong winds expected. Secure loose objects and be cautious outdoors",
      });
    }

    // Weather-specific insights
    if (weather === "Rain") {
      insights.push({
        icon: "fas fa-umbrella",
        color: "#3b82f6",
        title: "Rain expected",
        description:
          "Don't forget your umbrella! Perfect weather for cozy indoor activities",
      });
    }

    // Display insights
    const container = document.getElementById("weatherInsights");
    container.innerHTML = "";

    insights.forEach((insight) => {
      const insightDiv = document.createElement("div");
      insightDiv.className = "insight-item";
      insightDiv.innerHTML = `
                <div class="insight-icon" style="background-color: ${insight.color}">
                    <i class="${insight.icon}"></i>
                </div>
                <div class="insight-content">
                    <h4>${insight.title}</h4>
                    <p>${insight.description}</p>
                </div>
            `;
      container.appendChild(insightDiv);
    });
  }

  getWeatherIconInfo(weatherMain, iconCode) {
    const isDay = iconCode && iconCode.includes("d");

    const iconMap = {
      Clear: {
        class: isDay ? "fas fa-sun" : "fas fa-moon",
        color: isDay ? "weather-sunny" : "weather-cloudy",
      },
      Clouds: {
        class: "fas fa-cloud",
        color: "weather-cloudy",
      },
      Rain: {
        class: "fas fa-cloud-rain",
        color: "weather-rainy",
      },
      Snow: {
        class: "fas fa-snowflake",
        color: "weather-snowy",
      },
      Thunderstorm: {
        class: "fas fa-bolt",
        color: "weather-stormy",
      },
      Drizzle: {
        class: "fas fa-cloud-drizzle",
        color: "weather-rainy",
      },
      Mist: {
        class: "fas fa-smog",
        color: "weather-foggy",
      },
      Fog: {
        class: "fas fa-smog",
        color: "weather-foggy",
      },
    };

    return iconMap[weatherMain] || iconMap["Clear"];
  }

  getWindDirection(degrees) {
    const directions = [
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "SSE",
      "S",
      "SSW",
      "SW",
      "WSW",
      "W",
      "WNW",
      "NW",
      "NNW",
    ];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }

  startVoiceSearch() {
    if (!this.isVoiceSupported) {
      this.showToast("Voice search not supported", "error");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    const voiceBtn = document.getElementById("voiceBtn");
    const originalIcon = voiceBtn.querySelector("i").className;

    voiceBtn.querySelector("i").className = "fas fa-microphone-alt";
    voiceBtn.style.color = "#ef4444";

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      document.getElementById("cityInput").value = transcript;
      this.searchCity(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      this.showToast("Voice recognition error", "error");
    };

    recognition.onend = () => {
      voiceBtn.querySelector("i").className = originalIcon;
      voiceBtn.style.color = "";
    };

    recognition.start();
    this.showToast("Speak now...", "info");
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    const body = document.body;
    const themeIcon = document.querySelector("#themeToggle i");

    if (this.isDarkMode) {
      body.classList.add("dark-theme");
      body.classList.remove("light-theme");
      themeIcon.className = "fas fa-sun";
    } else {
      body.classList.add("light-theme");
      body.classList.remove("dark-theme");
      themeIcon.className = "fas fa-moon";
    }

    localStorage.setItem("darkMode", this.isDarkMode);
    this.showToast(
      `${this.isDarkMode ? "Dark" : "Light"} mode activated`,
      "info"
    );
  }

  toggleFavorite() {
    if (!this.currentWeatherData) return;

    const cityName = this.currentWeatherData.name;
    const country = this.currentWeatherData.sys.country;
    const favoriteKey = `${cityName}, ${country}`;

    const existingIndex = this.favorites.findIndex(
      (fav) => fav.key === favoriteKey
    );

    if (existingIndex > -1) {
      this.favorites.splice(existingIndex, 1);
      this.showToast("Removed from favorites", "info");
    } else {
      this.favorites.push({
        key: favoriteKey,
        name: cityName,
        country: country,
        coords: this.currentWeatherData.coord,
        addedAt: new Date().toISOString(),
      });
      this.showToast("Added to favorites", "success");
    }

    localStorage.setItem("favorites", JSON.stringify(this.favorites));
    this.updateFavoriteButton(cityName, country);
  }

  updateFavoriteButton(cityName, country) {
    const favoriteBtn = document.getElementById("favoriteBtn");
    const favoriteKey = `${cityName}, ${country}`;
    const isFavorite = this.favorites.some((fav) => fav.key === favoriteKey);

    const icon = favoriteBtn.querySelector("i");
    if (isFavorite) {
      icon.className = "fas fa-heart";
      favoriteBtn.classList.add("active");
    } else {
      icon.className = "far fa-heart";
      favoriteBtn.classList.remove("active");
    }
  }

  showFavorites() {
    if (this.favorites.length === 0) {
      this.showToast("No favorites saved", "info");
      return;
    }

    const favoritesText = this.favorites.map((fav) => fav.name).join(", ");
    this.showToast(`Favorites: ${favoritesText}`, "info");
  }

  showNotifications() {
    if (this.notifications.length === 0) {
      this.showToast("No notifications", "info");
      return;
    }

    this.showToast(`${this.notifications.length} notification(s)`, "info");
  }

  openShareModal() {
    const modal = document.getElementById("shareModal");
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  closeShareModal() {
    const modal = document.getElementById("shareModal");
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
  }

  closeAlertModal() {
    const modal = document.getElementById("alertModal");
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
  }

  async handleShare(platform) {
    if (!this.currentWeatherData) {
      this.showToast("No weather data to share", "error");
      return;
    }

    const { name, main, weather } = this.currentWeatherData;
    const temp = Math.round(main.temp);
    const description = weather[0].description;

    const shareText = `🌤️ Weather in ${name}: ${temp}°C, ${description}. 
        
📊 Details:
• Feels like: ${Math.round(main.feels_like)}°C
• Humidity: ${main.humidity}%
• Wind: ${Math.round(this.currentWeatherData.wind.speed * 3.6)} km/h

Check out WeatherVibe Pro! 🚀`;

    const shareUrl = window.location.href;

    switch (platform) {
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            shareText
          )}&url=${encodeURIComponent(shareUrl)}`,
          "_blank"
        );
        break;
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            shareUrl
          )}&quote=${encodeURIComponent(shareText)}`,
          "_blank"
        );
        break;
      case "whatsapp":
        window.open(
          `https://wa.me/?text=${encodeURIComponent(
            shareText + " " + shareUrl
          )}`,
          "_blank"
        );
        break;
      case "copy":
        try {
          await navigator.clipboard.writeText(shareText + " " + shareUrl);
          this.showToast("Link copied to clipboard", "success");
        } catch (error) {
          this.showToast("Unable to copy link", "error");
        }
        break;
    }

    this.closeShareModal();
  }

  showLoading() {
    document.getElementById("loadingSection").style.display = "block";
    document.getElementById("weatherSection").style.display = "none";
    document.getElementById("errorSection").style.display = "none";
  }

  hideLoading() {
    document.getElementById("loadingSection").style.display = "none";
  }

  showWeatherDisplay() {
    document.getElementById("weatherSection").style.display = "block";
    document.getElementById("errorSection").style.display = "none";
  }

  showError(message) {
    document.getElementById("errorMessage").textContent = message;
    document.getElementById("errorSection").style.display = "block";
    document.getElementById("weatherSection").style.display = "none";
  }

  showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icons = {
      success: "fas fa-check-circle",
      error: "fas fa-exclamation-triangle",
      info: "fas fa-info-circle",
    };

    toast.innerHTML = `
            <div class="toast-icon">
                <i class="${icons[type]}"></i>
            </div>
            <div class="toast-message">${message}</div>
        `;

    document.getElementById("toastContainer").appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  new WeatherApp();
});

// Global error handling
window.addEventListener("error", (event) => {
  console.error("Global error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});
