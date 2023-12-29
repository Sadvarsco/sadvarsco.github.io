let originalOrder = [];
document.querySelectorAll('.character').forEach((char, index) => {
    originalOrder[index] = char;
});

let selectedCharacters = [];

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

        // Gray out the first 10 selected characters
        if (selectedCharacters.length === 20) {
            document.querySelectorAll('.character').forEach(char => {
                if (selectedCharacters.includes(char.id)) {
                    char.classList.add('grayed-out');
                }
            });
        }

        // Make the next 5 selected characters unselectable
        if (selectedCharacters.length > 20 && selectedCharacters.length <= 70) {
            document.getElementById(characterId).classList.add('unselectable');
        }
    }
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

/* function resetSelection() {
    // Clear the selectedCharacters array
    selectedCharacters = [];

    // Remove all added classes from characters
    document.querySelectorAll('.character').forEach(char => {
        char.classList.remove('selected', 'grayed-out', 'unselectable');
    });
} */


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

