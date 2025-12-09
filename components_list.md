# Circuit Simulator Component List

## Power Sources
- **VCC (Power Supply)**: Provides a constant high voltage (Logic 1).
- **GND (Ground)**: Provides a constant low voltage (Logic 0).
- **Clock**: Generates a square wave signal at a configurable frequency.

## Input Components
- **Push Button**: Momentary switch (High when pressed).
- **Toggle Switch**: Maintains state (On/Off).
- **Dip Switch**: A bank of toggle switches.
- **Keypad**: Matrix input for numeric entry.

## Output Components
- **LED**: Light Emitting Diode (Red, Green, Blue, etc.).
- **7-Segment Display**: Displays numbers 0-9.
- **Hex Display**: Displays 0-F.
- **RGB LED**: Color mixing based on 3 inputs.
- **Buzzer**: Produces sound when active.
- **Oscilloscope**: Graphs voltage over time.
- **TTY / Text Display**: Displays ASCII characters.

## Logic Gates
- **NOT (Inverter)**: Inverts the signal.
- **AND**: High if all inputs are high.
- **OR**: High if any input is high.
- **NAND**: Low if all inputs are high.
- **NOR**: Low if any input is high.
- **XOR**: High if inputs are different.
- **XNOR**: High if inputs are the same.
- **Buffer**: Passes signal unchanged (useful for delays or isolation).
- **Tri-State Buffer**: Passes signal only when enabled.

## Flip-Flops & Latches
- **SR Latch**: Set/Reset memory.
- **D Flip-Flop**: Data latch on clock edge.
- **JK Flip-Flop**: Universal flip-flop.
- **T Flip-Flop**: Toggles state on clock edge.

## Multiplexers & Demultiplexers
- **MUX (2:1, 4:1, 8:1)**: Selects one input to pass to output.
- **DEMUX (1:2, 1:4, 1:8)**: Routes one input to a selected output.

## Arithmetic & Logic
- **Half Adder**: Adds two bits.
- **Full Adder**: Adds three bits (includes carry in).
- **Comparator**: Compares two binary numbers (=, <, >).
- **ALU (Arithmetic Logic Unit)**: Performs selectable operations.

## Memory
- **Register**: Stores a byte or word.
- **RAM**: Random Access Memory.
- **ROM**: Read-Only Memory.
- **EEPROM**: Electrically Erasable Programmable ROM.

## Passive / Analog (Simulated Logic)
- **Resistor**: Pull-up / Pull-down functionality.
- **Capacitor**: Simple delay / smoothing.
- **Diode**: One-way current flow.
- **Transistor (NPN/PNP)**: Basic switching element.

## Advanced / Custom
- **Custom IC**: User-created chips from sub-circuits.
- **Microcontroller**: Programmable unit (advanced goal).
