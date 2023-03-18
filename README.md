# Pixel-Pals
Pixel Pals is a fun and engaging console game that I created using Python and Pygame. The game features colorful pixelated graphics and challenges players to navigate a character through a series of obstacles while collecting coins and power-ups.

This is a C++ code that implements a console-based game where the player moves around a map and tries to collect all the dots while avoiding the enemy. The code uses the BFS algorithm to find the shortest path between the player and the enemy.

***
# Installation
To run the game, follow these steps:

Download the source code from the Github repository.
Open a C++ compiler, such as Code::Blocks or Dev-C++, and create a new project.
Add the main.cpp and header.h files to the project.
Compile and run the project.

Alternatively, you can create an executable file using the following steps:

Open a C++ compiler, such as Code::Blocks or Dev-C++, and create a new project.
Add the main.cpp and header.h files to the project.
Compile the project.
Create an executable file by going to File > Create New Executable.
Run the executable file to play the game.
Note: The game has been tested on Windows operating system only.

***
# Functions
The main functions of the game include:

* Moving the character around the grid using arrow keys
* Collecting coins
* Avoiding obstacles
* Keeping track of the player's score
* Generating a new game board after the player has completed the current one

Here's a brief overview of the code:

* The map is defined using a 2D character array, where each character represents a different object in the game (e.g. walls, dots, player, enemy).
* The ShowMap() function prints the current state of the map on the console.
* The entity class represents a player or an enemy object in the game, and stores their current position on the map.
* The gotoxy() function is used to set the cursor position on the console, which allows the code to draw the entities on the map.
* The BFSArray vector is used to store the nodes visited during the BFS algorithm, and the walk_queue vector is used to store the shortest path found between the player and the enemy.
* The FindPath() function implements the BFS algorithm to find the shortest path between two points on the map.
* The main game loop repeatedly gets user input to move the player around the map, updates the position of the enemy based on the shortest path found by the BFS algorithm, and checks for collisions between the player and the enemy or the dots.

Overall, this code is a good example of how to implement a simple game using console input/output and basic algorithms like BFS. However, for future improvement could improvement using better programming practices (e.g. using object-oriented design, separating game logic from input/output, modularizing the code into smaller functions).
