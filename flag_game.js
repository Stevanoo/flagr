DATA_DIR = "images/png/countries/"
IMG_EXT = ".png"
DATA_DIR = "images/svg/"
IMG_EXT = ".svg"

FLAG_COUNT = 9
var correct_code = null

var code2country = null
var gdp_probs = null

var flag_color_dist = null
var flag_mse = null
var flag_mse_flips = null
var flag_mse_rotations = null
var flag_edges_mse = null
METRICS = ["color", "mse", "mse_flips", "mse_rotations", "edges_mse"]
METRIC_NAMES = ["Color Palette", "Per Pixel", "Flips", "Rotations", "Edges"]
COLOR_WEIGHTS = [100, 2, 2, 0, 10] // Emphasis on color (nice for aesthetics)
BALANCED_WEIGHTS = [100, 8, 34, 0, 13] // Seems to be well balanced

DEFAULT_WEIGHTS = BALANCED_WEIGHTS

EXAMPLE_COUNTRIES = ["greece", "bahamas", "ireland", "japan", "denmark"] // Nice examples to show the different metrics

var country_codes = []
var countries = []

var recent_flags = []
var recent_outcomes = []


grid_configs = {
    1: "1x1",
    2: "1x2",
    3: "1x3",
    4: "2x2",
    5: "2x3",
    6: "2x3",
    7: "2x4",
    8: "2x4",
    9: "3x3",
}


function create_and_append(type, parent=null, id=null, class_=null) {
    if (parent == null)
        parent = document.body

    let element = document.createElement(type)

    if (id != null)
        element.id = id
    if (class_ != null)
        element.setAttribute('class', class_)

    parent.appendChild(element)
    return element
}

function sum(arr) {
    return arr.reduce((a, b) => a + b, 0)
}
function mean(arr) {
    return sum(arr) / arr.length
}
function normalise(arr) {
    let total = sum(arr)
    return arr.map(x => x / total)
}

function multinomial_sample(array, probs, seed=null) {
    let rand = Math.random()
    if (seed) {rand = random(seed)}
    let sum = 0
    for (let i in array) {
        sum += probs[i]
        if (sum > rand) {
            return array[i]
        }
    }
}

function capitalize(str) {
    return str.split(" ").map(word => word[0].toUpperCase() + word.slice(1)).join(" ")
}

// Read countries from file code2country.json
fetch('json/code2country.json')
    .then(function (response) {
        return response.json();
    })
    .then(function (data) {
        code2country = data
        country_codes = Object.keys(code2country)
        countries = Object.values(code2country)
        init_flag_game()
    })
    // .catch(function (err) {
    //     console.log('error: ' + err);
    // });
fetch('json/GDP_probabilities.json')
    .then(function (response) {
        return response.json();
    })
    .then(function (data) {
        gdp_probs = data
        init_flag_game()
    })
fetch('json/color_dist_matrix.json')
    .then(function (response) {
        return response.json();
    })
    .then(function (data) {
        flag_color_dist = data
        init_flag_game()
    })
fetch('json/flag_mse_matrix.json')
    .then(function (response) {
        return response.json();
    })
    .then(function (data) {
        flag_mse = data
        init_flag_game()
    })
fetch('json/flag_mse_matrix_flips.json')
    .then(function (response) {
        return response.json();
    })
    .then(function (data) {
        flag_mse_flips = data
        init_flag_game()
    })
fetch('json/flag_mse_matrix_rotations.json')
    .then(function (response) {
        return response.json();
    })
    .then(function (data) {
        flag_mse_rotations = data
        init_flag_game()
    })
fetch('json/flag_edges_mse_matrix.json')
    .then(function (response) {
        return response.json();
    })
    .then(function (data) {
        flag_edges_mse = data
        init_flag_game()
    })


function init_flag_game() {
    if (code2country == null || flag_color_dist == null || flag_mse == null || flag_mse_flips == null || flag_mse_rotations == null || flag_edges_mse == null || gdp_probs == null)
        return

    let question_div = create_and_append("h1", document.body, "question_div")

    // let idx = Math.floor(Math.random() * country_codes.length)
    // correct_code = country_codes[idx]
    correct_code = get_new_flag()
    let idx = country_codes.indexOf(correct_code)
    add_to_recent_flags(correct_code)
    let country = code2country[correct_code]
    question_div.innerHTML = country

    // Select closest n flags based on flag_color_dist, flag_mse and flag_edges_mse, weighted equally
    // where n = FLAG_COUNT - 1
    // let closest_flags = find_closest_flags(idx)
    let [closest_indices, distances] = find_weighted_closest_n(
        [flag_color_dist, flag_mse, flag_mse_flips, flag_mse_rotations, flag_edges_mse], idx, FLAG_COUNT - 1, DEFAULT_WEIGHTS)
    let closest_flags = closest_indices.map(i => country_codes[i])

    let div = add_image_grid(document.body, FLAG_COUNT, id="flag_grid")

    // For each image in the grid set the src to the flag of the country
    let imgs = div.getElementsByTagName("img")
    imgs[0].src = DATA_DIR + correct_code + IMG_EXT
    for (let i = 1; i < imgs.length; i++) {
        let img = imgs[i]
        // let country_code = country_codes[Math.floor(Math.random() * country_codes.length)]
        let country_code = closest_flags[i-1]
        img.dataset.dist = distances[i-1]

        // Set src to the flag of the country
        img.src = DATA_DIR + country_code + IMG_EXT
    }

    // Add function onclick to each image to check if it's the correct one
    for (let i = 0; i < imgs.length; i++) {
        let img = imgs[i]
        img.onclick = function() {
            // If already guessed, do nothing
            if (img.dataset.guessed == "true")
                return
            // If endgame overlay is shown, do nothing
            if (document.getElementById("endgame_overlay") != null)
                return

            img.dataset.guessed = "true"

            // Overlay country name on image
            overlay_country_name(img)

            // Add animation that makes the image smaller and then bigger again
            img.style.animation = "pop 0.5s"
            img.style.animationFillMode = "forwards"
            // Remove animation after 0.5s
            setTimeout(function() {
                img.style.animation = ""
            }, 500)
            
            check_answer(img)
        }
        // Set cursor to pointer
        img.style.cursor = "pointer"

        // Make colour lighter if hovering over image
        img.onmouseover = function() {
            if (img.dataset.guessed == "true") return

            img.style.filter = "brightness(0.7)"
        }
        img.onmouseout = function() {
            if (img.dataset.guessed == "true") return

            img.style.filter = "brightness(1)"
        }
    }

    shuffle_elements(div)
}

function add_to_recent_flags(code) {
    recent_flags.unshift(code)
    if (recent_flags.length > 20)
        recent_flags.pop()
}
function add_to_recent_outcomes(outcome) {
    recent_outcomes.unshift(outcome)
    // if (recent_outcomes.length > 20)
    //     recent_outcomes.pop()
}

/** Function for getting new "question" flag based on different probabilities */
function get_new_flag() {
    // Assign probabilities to each flag
    let probabilities = []
    for (let i = 0; i < country_codes.length; i++) {
        let code = country_codes[i]

        let success_weight = mean(recent_outcomes.slice(0, 10))
        // If no outcomes yet, set to 0
        if (recent_outcomes.length < 10)
            success_weight = 0

        let weighted_gdp_prob = success_weight * (1-gdp_probs[code]) + (1 - success_weight) * gdp_probs[code]
        let prob = get_recency_probability(code) * weighted_gdp_prob

        probabilities.push(prob)
    }
    // Normalise probabilities
    probabilities = normalise(probabilities)
    // Sample from the distribution
    let code = multinomial_sample(country_codes, probabilities)
    console.log(code2country[code])
    console.log("GDP probability: ", gdp_probs[code])
    console.log("Final probability rank: ", probabilities.indexOf(probabilities.find(p => p == probabilities[code])))
    return code
}

/** Probability penalty based on recency */
function get_recency_probability(code) {
    let idx = recent_flags.indexOf(code)

    // If not in recent_flags, return 1
    if (idx == -1)
        return 1

    unbounded = (idx/20)**4
    return Math.min(unbounded, 1)
}

function overlay_country_name(img) {
    img.style.cursor = "default"
    img.style.filter = "brightness(0.5)"
    let overlay = create_and_append("div", img.parentElement, null, "country_name_overlay")
    overlay.innerHTML = code2country[img.src.split("/").pop().split(".")[0]]
}

function display_endgame_overlay(win, message) {
    let overlay = create_and_append("div", document.body, "endgame_overlay", "overlay")
    overlay.style.display = "block"
    overlay.style.position = "fixed"

    let endgame_div = create_and_append("div", overlay, "endgame_div", "overlay-content")
    // Add message as h1
    let h1 = create_and_append("h1", endgame_div)
    h1.innerHTML = message

    // Display SCORE and score percentage
    let score_div = create_and_append("h2", endgame_div, "score_div")
    score_div.innerHTML = "Score: " + sum(recent_outcomes) + " / " + recent_outcomes.length + " (" + Math.round(mean(recent_outcomes) * 100) + "%)"
    score_div.style.marginBottom = "20px"

    // Buttons div so they go next to each other
    let buttons_div = create_and_append("div", endgame_div, "buttons_div")
    buttons_div.style.display = "flex"

    // Add restart button
    let restart_button = create_and_append("button", buttons_div, "restart_button", "btn btn-secondary")
    restart_button.innerHTML = "Next"
    restart_button.onclick = function() {
        document.getElementById("flag_grid").remove()
        document.getElementById("question_div").remove()
        document.getElementById("endgame_overlay").remove()
        init_flag_game()
    }
    // Only add try again button if lost
    if (!win) {
        // Try again button
        let try_again_button = create_and_append("button", buttons_div, "try_again_button", "btn btn-secondary")
        try_again_button.innerHTML = "Try again"
        try_again_button.onclick = function() {
            document.getElementById("endgame_overlay").remove()
        }
    }
}

function check_answer(img) {
    if (img.src.endsWith(correct_code + IMG_EXT)) {
        // Correct
        add_to_recent_outcomes(1)
        display_endgame_overlay(true, "Correct!")

        // Overlay country name on each image
        let imgs = document.getElementById("flag_grid").getElementsByTagName("img")
        for (let img of imgs) {
            img.dataset.guessed = "true"
            overlay_country_name(img)
        }
    } else {
        // Incorrect
        add_to_recent_outcomes(0)
        display_endgame_overlay(false, "Incorrect!")
    }
}

function find_weighted_closest_n(matrices, idx, n, weights=[1, 1, 1]) {
    // Make sure there's as many weights as matrices
    if (weights.length != matrices.length) {
        console.error("Weights and matrices must be of same length")
        return null }

    let closest = []
    let closest_dist = []
    for (let i = 0; i < matrices[0].length; i++) {
        if (i == idx)
            continue

        // Dist is weighted sum of distances in each matrix
        let dist = 0
        for (let j = 0; j < matrices.length; j++) {
            dist += weights[j] * matrices[j][idx][i]
        }
        
        if (closest.length < n) {
            closest.push(i)
            closest_dist.push(dist)
        } else {
            let max_dist = Math.max(...closest_dist)
            let max_idx = closest_dist.indexOf(max_dist)
            if (dist < max_dist) {
                closest[max_idx] = i
                closest_dist[max_idx] = dist
            }
        }
    }
    // Sort closest by closest_dist
    for (let i = 0; i < closest.length; i++) {
        for (let j = i + 1; j < closest.length; j++) {
            if (closest_dist[i] > closest_dist[j]) {
                let temp = closest_dist[i]
                closest_dist[i] = closest_dist[j]
                closest_dist[j] = temp

                temp = closest[i]
                closest[i] = closest[j]
                closest[j] = temp
            }
        }
    }

    return [closest, closest_dist]
}

function find_closest_flags(idx) {
    let closest_flags = []

    // Find closest flag based on flag_color_dist
    closest_flags.push(country_codes[find_closest(flag_color_dist, idx)])

    // Find closest flag based on flag_mse
    closest_flags.push(country_codes[find_closest(flag_mse, idx)])

    // Find closest flag based on flag_edges_mse
    closest_flags.push(country_codes[find_closest(flag_edges_mse, idx)])

    return closest_flags
}

function find_closest(matrix, idx) {
    let closest = null
    let closest_dist = Infinity
    for (let i = 0; i < matrix.length; i++) {
        if (i == idx)
            continue

        let dist = matrix[idx][i]
        if (dist < closest_dist) {
            closest_dist = dist
            closest = i
        }
    }
    return closest
}

/** Add div with 3x3 image grid to the parent element */
function add_image_grid(parent, count, id="flag_grid") {
    // Create div element
    let div = create_and_append("div", parent, id, "image_grid image_grid"+grid_configs[FLAG_COUNT])

    // Create 3x3 grid of images
    for (let i = 0; i < count; i++) {
        let img_container = create_and_append("div", div, null, "img_container")
        create_and_append("img", img_container, null, "flag")
    }
    return div
}

function shuffle_elements(parent) {
    for (let i = parent.children.length; i >= 0; i--) {
        parent.appendChild(parent.children[Math.random() * i | 0]);
    }
}