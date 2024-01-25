let originalOrder = [];
document.querySelectorAll('.character').forEach((char, index) => {
    originalOrder[index] = char;
});

let selectedCharacters = [];
let grayOutLimit = 1; // Default value

function updateGrayOutCount() {
    grayOutLimit = parseInt(document.getElementById('grayOutCount').value);
    resetSelection(); // Optionally reset selection when the limit changes
}

function resetSelection() {
    // Clear the selectedCharacters array
    selectedCharacters = [];

    // Remove all added classes from characters
    document.querySelectorAll('.character').forEach(char => {
        char.classList.remove('selected', 'grayed-out', 'unselectable');
    });

    // Restore the original order
    const container = document.querySelector('.character-select-container');
    originalOrder.forEach(char => {
        container.appendChild(char);
    });
}

function selectCharacter(characterId) {
        if (selectedCharacters.length < 90 && !selectedCharacters.includes(characterId)) {
            selectedCharacters.push(characterId);
            document.getElementById(characterId).classList.add('selected');
    
            // Gray out characters based on the selected limit
            if (selectedCharacters.length === grayOutLimit) {
                document.querySelectorAll('.character').forEach(char => {
                    if (selectedCharacters.includes(char.id)) {
                        char.classList.add('grayed-out');
                    }
                });
            }
        if (selectedCharacters.length > grayOutLimit && selectedCharacters.length <= 90) {
            document.getElementById(characterId).classList.add('unselectable');
        }
    }
}


//Pop up box instructions
function openModal() {
    document.getElementById('infoModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
}

//create a dropdown list, currently 23 is the max
function populateDropdown() {
    const dropdown = document.getElementById('grayOutCount');
    for (let i = 1; i <= 23; i++) {
        const option = document.createElement('option');
        option.value = option.textContent = i;
        dropdown.appendChild(option);
    }
}

//populates dropdown list on page load
populateDropdown();

function resetSelection() {
    // Clear the selectedCharacters array
    selectedCharacters = [];

    // Remove all added classes from characters
    document.querySelectorAll('.character').forEach(char => {
        char.classList.remove('selected', 'grayed-out', 'unselectable');
    });

    // Restore the original order
    const container = document.querySelector('.character-select-container');
    originalOrder.forEach(char => {
        container.appendChild(char);
    });
}

//moves unselectable characters to the buttom/back of the list
function sortCharacters() {
    const container = document.querySelector('.character-select-container');
    let characters = Array.from(container.children);

    characters.sort((a, b) => {
        let aOrder = a.classList.contains('grayed-out') || a.classList.contains('unselectable') ? 1 : 0;
        let bOrder = b.classList.contains('grayed-out') || b.classList.contains('unselectable') ? 1 : 0;
        return aOrder - bOrder;
    });

    // Re-append characters in sorted order
    characters.forEach(char => container.appendChild(char));
}