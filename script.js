const locationInput = document.getElementById('locationInput');
const searchButton = document.getElementById('searchButton');
const locationElement = document.getElementById('location');
const temperatureElement = document.getElementById('temperature');
const descriptionElement = document.getElementById('description');
const loadingMessage = document.getElementById("loadingMessage");
const spinner = document.getElementById("spinner");

function formatHour12(date) {
  let hours = date.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:00 ${ampm}`;
}

window.onload = () => {
  if ("geolocation" in navigator) {
    loadingMessage.style.display = "block";
    loadingMessage.textContent = "Locating...";
    spinner.style.display = "block";
    navigator.geolocation.getCurrentPosition(
      pos => reverseGeocode(pos.coords.latitude, pos.coords.longitude),
      () => {
        loadingMessage.style.display = spinner.style.display = "none";
      }
    );
  }
};

searchButton.addEventListener('click', () => {
  const city = locationInput.value.trim();
  if (city) getCoordinatesAndWeather(city);
});

function getCoordinatesAndWeather(city) {
  fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
    .then(r => r.json())
    .then(data => {
      if (data.results?.length) {
        const { name, country, latitude, longitude } = data.results[0];
        getWeather(latitude, longitude, `${name}, ${country}`);
      } else {
        locationElement.textContent = "City not found.";
        temperatureElement.textContent = descriptionElement.textContent = "";
      }
    })
    .catch(() => {
      locationElement.textContent = "Error fetching location.";
    });
}

function getWeather(lat, lon, locationName) {
  const url = `https://api.open-meteo.com/v1/forecast`
    + `?latitude=${lat}&longitude=${lon}`
    + `&current_weather=true`
    + `&hourly=temperature_2m,apparent_temperature,weathercode,relative_humidity_2m,precipitation,precipitation_probability,uv_index,pressure_msl,winddirection_10m,windspeed_10m`
    + `&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset`
    + `&forecast_days=16`
    + `&timezone=auto`;

  fetch(url)
    .then(r => r.json())
    .then(data => {
      const now = new Date();
      const idx = data.hourly.time.findIndex(t => new Date(t) >= now);

      const c = data.current_weather;
      const desc = mapWeatherCodeToDescription(c.weathercode);
      locationElement.textContent = locationName;
      temperatureElement.textContent = `${c.temperature}°C`;
      descriptionElement.textContent = desc;
      const icon = document.getElementById('weatherIcon');
      icon.src = `icons/${c.weathercode}.svg`;
      icon.alt = desc;

      document.getElementById('humidity').textContent = `${data.hourly.relative_humidity_2m[idx] ?? '--'} %`;
      document.getElementById('pressure').textContent = data.hourly.pressure_msl[idx] ?? '--';
      document.getElementById('uv').textContent = data.hourly.uv_index[idx] ?? '--';
      document.getElementById('precip').textContent = `${data.hourly.precipitation[idx] ?? '--'} mm`;
      document.getElementById('rainprob').textContent = `${data.hourly.precipitation_probability[idx] ?? '--'} %`;
      document.getElementById('windspeed').textContent = data.hourly.windspeed_10m[idx] ?? '--';
      document.getElementById('feelslike').textContent = data.hourly.apparent_temperature[idx] != null
        ? `Feels like: ${data.hourly.apparent_temperature[idx]}°C`
        : "";

      const hourlyDiv = document.getElementById('hourly-forecast');
      hourlyDiv.innerHTML = '';
      const start = idx >= 0 ? idx : 0;
      for (let i = 0; i < 12 && start + i < data.hourly.time.length; i++) {
        const h = new Date(data.hourly.time[start + i]);
        const code = data.hourly.weathercode[start + i];
        hourlyDiv.innerHTML += `
          <div class="forecast-card">
            <div class="temp">${data.hourly.temperature_2m[start + i]}°</div>
            <img src="icons/${code}.svg" class="weather-icon"/>
            <div class="time">${formatHour12(h)}</div>
          </div>`;
      }

      const dailyDiv = document.getElementById('daily-forecast');
      dailyDiv.innerHTML = '';
      for (let i = 0; i < data.daily.time.length; i++) {
        const d = new Date(data.daily.time[i]);
        const code = data.daily.weathercode[i];
        dailyDiv.innerHTML += `
          <div class="forecast-card">
            <div class="day">${d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
            <img src="icons/${code}.svg" class="weather-icon"/>
            <div class="min-max_temp">${data.daily.temperature_2m_min[i]}°C / ${data.daily.temperature_2m_max[i]}°C</div>
            <div class="weather-desc">${mapWeatherCodeToDescription(code)}</div>
          </div>`;
      }

      loadingMessage.style.display = spinner.style.display = "none";
    })
    .catch(err => {
      console.error(err);
      locationElement.textContent = "Error fetching weather.";
      loadingMessage.style.display = spinner.style.display = "none";
    });
}

function mapWeatherCodeToDescription(code) {
  const codes = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
    55: "Dense drizzle", 56: "Freezing drizzle (light)", 57: "Freezing drizzle (dense)",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain", 66: "Freezing rain (light)",
    67: "Freezing rain (heavy)", 71: "Slight snow fall", 73: "Moderate snow fall",
    75: "Heavy snow fall", 77: "Snow grains", 80: "Rain showers (slight)",
    81: "Rain showers (moderate)", 82: "Rain showers (violent)", 85: "Snow showers (slight)",
    86: "Snow showers (heavy)", 95: "Thunderstorm", 96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
  };
  return codes[code] || "Unknown weather";
}

function reverseGeocode(lat, lon) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`)
    .then(r => r.json())
    .then(data => {
      const addr = data.address || {};
      const parts = [addr.suburb, addr.city, addr.state, addr.country].filter(x => x);
      getWeather(lat, lon, parts.join(", ") || "Your Location");
    })
    .catch(() => {
      getWeather(lat, lon, "Your Location");
    });
}

const autocompleteList = document.createElement("ul");
autocompleteList.className = "autocomplete-list";
document.querySelector('.search-container').appendChild(autocompleteList);

locationInput.addEventListener("input", function () {
  autocompleteList.style.width = locationInput.offsetWidth + "px";
  const query = locationInput.value.trim();
  autocompleteList.innerHTML = "";
  if (!query) {
    autocompleteList.style.display = "none";
    return;
  }
  fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`)
    .then(res => res.json())
    .then(data => {
      if (data.results?.length > 0) {
        data.results.forEach(place => {
          const li = document.createElement("li");
          li.className = "autocomplete-item";
          const parts = [place.name, place.admin1, place.country].filter(Boolean);
          li.textContent = parts.join(", ");
          li.addEventListener("mousedown", function (e) {
            e.preventDefault();
            locationInput.value = "";
            autocompleteList.style.display = "none";
            getWeather(place.latitude, place.longitude, `${place.name}, ${place.country}`);
          });
          autocompleteList.appendChild(li);
        });
        autocompleteList.style.display = "block";
      } else {
        autocompleteList.style.display = "none";
      }
    })
    .catch(() => {
      autocompleteList.style.display = "none";
    });
});

document.addEventListener("mousedown", function (e) {
  if (!locationInput.contains(e.target) && !autocompleteList.contains(e.target)) {
    autocompleteList.style.display = "none";
  }
});
