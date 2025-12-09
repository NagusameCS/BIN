# Circuit Simulator Game

A web-based circuit simulator where you can design, build, and simulate digital logic circuits.

## Features
- **Basic Components**: VCC, GND, Clock, Switch, Button, LED, Display.
- **Logic Gates**: AND, OR, NOT.
- **Custom Chips**: Build a circuit, add Input/Output pins, and save it as a reusable chip!
- **Import/Export**: Save your circuits to JSON and load them back.
- **Simulation**: Real-time logic simulation with visual feedback.

## How to Run
Because this project uses JavaScript ES Modules, you need to run it via a local web server. You cannot just open `index.html` directly in the browser.

### Using Python (if installed)
1. Open a terminal in this folder.
2. Run: `python3 -m http.server`
3. Open your browser to `http://localhost:8000`

### Using VS Code Live Server
1. Install the "Live Server" extension.
2. Right-click `index.html` and select "Open with Live Server".

## How to Use
1. **Select a component** from the toolbar.
2. **Click on the grid** to place it.
3. **Select 'Wire' tool** to connect components. Click start point, then click end point.
4. **Select 'Select' tool** to interact with switches/buttons or drag components.
5. **Play/Pause** to control the simulation.

### Creating Custom Chips
1. Build a circuit you want to reuse (e.g., a NAND gate using AND+NOT, or a Flip-Flop).
2. Add **Input Pin** components for inputs.
3. Add **Output Pin** components for outputs.
4. Click **Create Chip**.
5. Give it a name (e.g., "MyLatch").
6. The new chip will appear in the "Custom" section of the toolbar.
7. You can now place "MyLatch" chips in your main circuit!
