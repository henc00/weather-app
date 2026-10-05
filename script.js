"use strict";

const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_GEOCODING_API = "https://nominatim.openstreetmap.org/reverse";

const searchForm = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const locationButton = document.getElementById("locationButton");
const statusMessage = document.getElementById("statusMessage");
const citySuggestions =
    document.getElementById("citySuggestions");

let suggestionTimer = null;
let suggestionController = null;

const weatherContent = document.getElementById("weatherContent");
const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");
const retryButton = document.getElementById("retryButton");
const loadingOverlay = document.getElementById("loadingOverlay");

const locationName = document.getElementById("locationName");
const currentDate = document.getElementById("currentDate");
const weatherIcon = document.getElementById("weatherIcon");
const currentTemperature = document.getElementById("currentTemperature");
const weatherDescription = document.getElementById("weatherDescription");
const feelsLike = document.getElementById("feelsLike");

const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("windSpeed");
const precipitation = document.getElementById("precipitation");
const windDirection = document.getElementById("windDirection");

const forecastGrid = document.getElementById("forecastGrid");

let lastLocation = null;

const WEATHER_CODES = {
    0: {
        description: "Clear sky",
        icon: "☀️"
    },
    1: {
        description: "Mainly clear",
        icon: "🌤️"
    },
    2: {
        description: "Partly cloudy",
        icon: "⛅"
    },
    3: {
        description: "Overcast",
        icon: "☁️"
    },
    45: {
        description: "Fog",
        icon: "🌫️"
    },
    48: {
        description: "Depositing rime fog",
        icon: "🌫️"
    },
    51: {
        description: "Light drizzle",
        icon: "🌦️"
    },
    53: {
        description: "Moderate drizzle",
        icon: "🌦️"
    },
    55: {
        description: "Dense drizzle",
        icon: "🌧️"
    },
    56: {
        description: "Light freezing drizzle",
        icon: "🌧️"
    },
    57: {
        description: "Dense freezing drizzle",
        icon: "🌧️"
    },
    61: {
        description: "Slight rain",
        icon: "🌦️"
    },
    63: {
        description: "Moderate rain",
        icon: "🌧️"
    },
    65: {
        description: "Heavy rain",
        icon: "🌧️"
    },
    66: {
        description: "Light freezing rain",
        icon: "🌧️"
    },
    67: {
        description: "Heavy freezing rain",
        icon: "🌧️"
    },
    71: {
        description: "Slight snow",
        icon: "🌨️"
    },
    73: {
        description: "Moderate snow",
        icon: "🌨️"
    },
    75: {
        description: "Heavy snow",
        icon: "❄️"
    },
    77: {
        description: "Snow grains",
        icon: "❄️"
    },
    80: {
        description: "Slight rain showers",
        icon: "🌦️"
    },
    81: {
        description: "Moderate rain showers",
        icon: "🌧️"
    },
    82: {
        description: "Violent rain showers",
        icon: "⛈️"
    },
    85: {
        description: "Slight snow showers",
        icon: "🌨️"
    },
    86: {
        description: "Heavy snow showers",
        icon: "❄️"
    },
    95: {
        description: "Thunderstorm",
        icon: "⛈️"
    },
    96: {
        description: "Thunderstorm with hail",
        icon: "⛈️"
    },
    99: {
        description: "Thunderstorm with heavy hail",
        icon: "⛈️"
    }
};

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    initializeWeather();
});

function setupEventListeners() {
    cityInput.addEventListener(
        "input",
        handleCityInput
    );

    searchForm.addEventListener("submit", handleSearch);
    locationButton.addEventListener("click", requestUserLocation);
    retryButton.addEventListener("click", retryLastRequest);
}

function initializeWeather() {
    if (!navigator.geolocation) {
        setStatus(
            "Geolocation is not supported by your browser. Showing Berlin instead."
        );

        loadWeatherForCoordinates(
            52.52,
            13.405,
            "Berlin",
            "Germany"
        );

        return;
    }

    setStatus("Detecting your location...");

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;

            try {
                const location = await reverseGeocode(
                    latitude,
                    longitude
                );

                await loadWeatherForCoordinates(
                    latitude,
                    longitude,
                    location.city,
                    location.country
                );
            } catch (error) {
                console.warn(
                    "Reverse geocoding failed:",
                    error
                );

                await loadWeatherForCoordinates(
                    latitude,
                    longitude,
                    "Your Location",
                    ""
                );
            }
        },
        () => {
            setStatus(
                "Location access was unavailable. Showing Berlin. You can search for another city."
            );

            loadWeatherForCoordinates(
                52.52,
                13.405,
                "Berlin",
                "Germany"
            );
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

function requestUserLocation() {
    if (!navigator.geolocation) {
        showError(
            "Your browser does not support geolocation. Please search for a city."
        );

        return;
    }

    setStatus("Finding your current location...");

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;

            try {
                showLoading(true);

                const location = await reverseGeocode(
                    latitude,
                    longitude
                );

                await loadWeatherForCoordinates(
                    latitude,
                    longitude,
                    location.city,
                    location.country
                );
            } catch (error) {
                console.warn(
                    "Reverse geocoding failed:",
                    error
                );

                await loadWeatherForCoordinates(
                    latitude,
                    longitude,
                    "Your Location",
                    ""
                );
            } finally {
                showLoading(false);
            }
        },
        (error) => {
            let message =
                "We couldn't access your location.";

            if (error.code === 1) {
                message =
                    "Location permission was denied. Please allow location access in your browser or search for a city.";
            } else if (error.code === 2) {
                message =
                    "Your location could not be determined. Please try again or search for a city.";
            } else if (error.code === 3) {
                message =
                    "Location request timed out. Please try again.";
            }

            showError(message);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

async function reverseGeocode(latitude, longitude) {
    const url = new URL(REVERSE_GEOCODING_API);

    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", latitude);
    url.searchParams.set("lon", longitude);
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString());

    if (!response.ok) {
        throw new Error(
            "Unable to determine your city."
        );
    }

    const data = await response.json();

    if (!data.address) {
        throw new Error(
            "No address information was returned."
        );
    }

    const address = data.address;

    const city =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.county ||
        "Your Location";

    const country =
        address.country || "";

    return {
        city,
        country
    };
}

function handleCityInput() {
    const query = cityInput.value.trim();

    clearTimeout(suggestionTimer);

    if (suggestionController) {
        suggestionController.abort();
        suggestionController = null;
    }

    if (query.length < 2) {
        hideSuggestions();
        return;
    }

    suggestionTimer = setTimeout(
        () => fetchCitySuggestions(query),
        250
    );
}

async function fetchCitySuggestions(query) {
    suggestionController =
        new AbortController();

    try {
        const url = new URL(GEOCODING_API);

        url.searchParams.set(
            "name",
            query
        );

        url.searchParams.set(
            "count",
            "6"
        );

        url.searchParams.set(
            "language",
            "en"
        );

        url.searchParams.set(
            "format",
            "json"
        );

        const response = await fetch(
            url.toString(),
            {
                signal:
                    suggestionController.signal
            }
        );

        if (!response.ok) {
            hideSuggestions();
            return;
        }

        const data = await response.json();

        if (
            !data.results ||
            data.results.length === 0
        ) {
            hideSuggestions();
            return;
        }

        renderCitySuggestions(
            data.results
        );
    } catch (error) {
        if (error.name !== "AbortError") {
            console.warn(
                "City suggestions failed:",
                error
            );

            hideSuggestions();
        }
    }
}

function renderCitySuggestions(results) {
    citySuggestions.innerHTML = "";

    results.forEach((location) => {
        const suggestion =
            document.createElement("button");

        suggestion.type = "button";
        suggestion.className =
            "city-suggestion";
        suggestion.setAttribute(
            "role",
            "option"
        );

        const locationParts = [
            location.admin1,
            location.country
        ].filter(Boolean);

        suggestion.innerHTML = `
            <span class="city-suggestion-name">
                ${escapeHTML(location.name)}
            </span>

            <span class="city-suggestion-location">
                ${escapeHTML(
                    locationParts.join(", ")
                )}
            </span>
        `;

        suggestion.addEventListener(
            "click",
            () => selectCitySuggestion(location)
        );

        citySuggestions.appendChild(
            suggestion
        );
    });

    citySuggestions.classList.remove(
        "hidden"
    );
}

async function selectCitySuggestion(location) {
    cityInput.value = location.name;

    hideSuggestions();

    try {
        showLoading(true);
        hideError();

        setStatus(
            `Loading weather for ${location.name}...`
        );

        await loadWeatherForCoordinates(
            location.latitude,
            location.longitude,
            location.name,
            location.country
        );
    } finally {
        showLoading(false);
    }
}

function hideSuggestions() {
    citySuggestions.classList.add(
        "hidden"
    );

    citySuggestions.innerHTML = "";
}

async function handleSearch(event) {
    event.preventDefault();

    const city = cityInput.value.trim();

    if (!city) {
        setStatus("Please enter a city name.");
        cityInput.focus();
        return;
    }

    if (city.length < 2) {
        setStatus("Please enter at least two characters.");
        cityInput.focus();
        return;
    }

    try {
        showLoading(true);
        hideError();

        setStatus(`Searching for ${city}...`);

        const location = await geocodeCity(city);

        if (!location) {
            throw new Error(
                `We couldn't find "${city}". Try a different city name.`
            );
        }

        await loadWeatherForCoordinates(
            location.latitude,
            location.longitude,
            location.name,
            location.country
        );
    } catch (error) {
        console.error(error);

        showError(
            error.message ||
            "We couldn't find that city. Please try again."
        );
    } finally {
        showLoading(false);
    }
}

async function geocodeCity(city) {
    const url = new URL(GEOCODING_API);

    url.searchParams.set("name", city);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const response = await fetch(url.toString());

    if (!response.ok) {
        throw new Error(
            "The city search service is temporarily unavailable."
        );
    }

    const data = await response.json();

    if (
        !data.results ||
        data.results.length === 0
    ) {
        return null;
    }

    return data.results[0];
}

async function loadWeatherForCoordinates(
    latitude,
    longitude,
    cityName,
    country
) {
    try {
        showLoading(true);
        hideError();

        const weather = await fetchWeather(
            latitude,
            longitude
        );

        lastLocation = {
            latitude,
            longitude,
            cityName,
            country
        };

        renderWeather(
            weather,
            cityName,
            country
        );

        setStatus(
            `Updated ${formatCurrentTime()}`
        );
    } catch (error) {
        console.error(error);

        showError(
            "We couldn't load the weather data. Please check your internet connection and try again."
        );
    } finally {
        showLoading(false);
    }
}

async function fetchWeather(
    latitude,
    longitude
) {
    const url = new URL(WEATHER_API);

    url.searchParams.set(
        "latitude",
        latitude
    );

    url.searchParams.set(
        "longitude",
        longitude
    );

    url.searchParams.set(
        "current",
        [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "weather_code",
            "wind_speed_10m",
            "wind_direction_10m",
            "precipitation"
        ].join(",")
    );

    url.searchParams.set(
        "daily",
        [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_probability_max",
            "precipitation_sum",
            "sunrise",
            "sunset"
        ].join(",")
    );

    url.searchParams.set(
        "temperature_unit",
        "celsius"
    );

    url.searchParams.set(
        "wind_speed_unit",
        "kmh"
    );

    url.searchParams.set(
        "timezone",
        "auto"
    );

    url.searchParams.set(
        "forecast_days",
        "5"
    );

    const response = await fetch(
        url.toString()
    );

    if (!response.ok) {
        throw new Error(
            "Weather service returned an error."
        );
    }

    const data = await response.json();

    if (
        !data.current ||
        !data.daily
    ) {
        throw new Error(
            "The weather service returned incomplete data."
        );
    }

    return data;
}

function renderWeather(
    data,
    cityName,
    country
) {
    const current = data.current;

    const weatherInfo =
        getWeatherInfo(
            current.weather_code
        );

    const displayLocation =
        cityName || "Your Location";

    if (
        country &&
        cityName !== "Your Location"
    ) {
        locationName.textContent =
            `${displayLocation}, ${country}`;
    } else {
        locationName.textContent =
            displayLocation;
    }

    currentDate.textContent =
        formatDate(new Date());

    weatherIcon.textContent =
        weatherInfo.icon;

    currentTemperature.textContent =
        Math.round(
            current.temperature_2m
        );

    weatherDescription.textContent =
        weatherInfo.description;

    feelsLike.textContent =
        `${Math.round(
            current.apparent_temperature
        )}°C`;

    humidity.textContent =
        `${Math.round(
            current.relative_humidity_2m
        )}%`;

    windSpeed.textContent =
        `${Math.round(
            current.wind_speed_10m
        )} km/h`;

    precipitation.textContent =
        `${Number(
            current.precipitation || 0
        ).toFixed(1)} mm`;

    windDirection.textContent =
        getWindDirection(
            current.wind_direction_10m
        );

    renderForecast(data.daily);

    weatherContent.classList.remove(
        "hidden"
    );

    errorState.classList.add(
        "hidden"
    );
}

function renderForecast(daily) {
    forecastGrid.innerHTML = "";

    for (
        let index = 0;
        index < daily.time.length;
        index++
    ) {
        const date = new Date(
            `${daily.time[index]}T12:00:00`
        );

        const weatherInfo =
            getWeatherInfo(
                daily.weather_code[index]
            );

        const card =
            document.createElement("article");

        card.className =
            "forecast-card";

        const dayName =
            index === 0
                ? "Today"
                : date.toLocaleDateString(
                    undefined,
                    {
                        weekday: "short"
                    }
                );

        const dateText =
            date.toLocaleDateString(
                undefined,
                {
                    month: "short",
                    day: "numeric"
                }
            );

        const maxTemperature =
            Math.round(
                daily.temperature_2m_max[index]
            );

        const minTemperature =
            Math.round(
                daily.temperature_2m_min[index]
            );

        const rainProbability =
            daily
                .precipitation_probability_max[
                index
            ] ?? 0;

        card.innerHTML = `
            <div class="forecast-day">
                ${escapeHTML(dayName)}
            </div>

            <div class="forecast-date">
                ${escapeHTML(dateText)}
            </div>

            <div class="forecast-icon">
                ${weatherInfo.icon}
            </div>

            <div class="forecast-condition">
                ${escapeHTML(
                    weatherInfo.description
                )}
            </div>

            <div class="forecast-temperature">
                <span class="max-temp">
                    ${maxTemperature}°
                </span>

                <span class="min-temp">
                    ${minTemperature}°
                </span>
            </div>

            <div class="forecast-rain">
                💧 ${rainProbability}% chance
            </div>
        `;

        forecastGrid.appendChild(card);
    }
}

function getWeatherInfo(code) {
    return (
        WEATHER_CODES[code] || {
            description: "Unknown conditions",
            icon: "🌡️"
        }
    );
}

function getWindDirection(degrees) {
    if (
        typeof degrees !== "number" ||
        Number.isNaN(degrees)
    ) {
        return "--";
    }

    const directions = [
        "N",
        "NE",
        "E",
        "SE",
        "S",
        "SW",
        "W",
        "NW"
    ];

    const index =
        Math.round(degrees / 45) % 8;

    return `${directions[index]} (${Math.round(
        degrees
    )}°)`;
}

function formatDate(date) {
    return date.toLocaleDateString(
        undefined,
        {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        }
    );
}

function formatCurrentTime() {
    return new Date().toLocaleTimeString(
        undefined,
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

function showLoading(isLoading) {
    loadingOverlay.classList.toggle(
        "hidden",
        !isLoading
    );
}

function setStatus(message) {
    statusMessage.textContent =
        message;
}

function showError(message) {
    showLoading(false);

    weatherContent.classList.add(
        "hidden"
    );

    errorState.classList.remove(
        "hidden"
    );

    errorMessage.textContent =
        message;

    setStatus("");
}

function hideError() {
    errorState.classList.add(
        "hidden"
    );
}

function retryLastRequest() {
    hideError();

    if (lastLocation) {
        loadWeatherForCoordinates(
            lastLocation.latitude,
            lastLocation.longitude,
            lastLocation.cityName,
            lastLocation.country
        );

        return;
    }

    initializeWeather();
}

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
