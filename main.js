import fs from 'node:fs/promises';


// Execute script
main();


/**
 * FUNCTIONS
 */
async function main() {
	const fileLines = await readFileLines('./input.mmd');
	const transitions = extractTransitionsFromInput(fileLines);
	const states = extractStatesFromTransitions(transitions);
	calcTransitions(states);
	filterStatesWithLeastTransitions(states);
	console.log(states)
}

async function readFileLines(filePath) {
	const input = await fs.readFile(filePath, 'utf8');
	return input.split('\r\n').map( line => line.trim() );
}

function extractTransitionsFromInput(arrayInput) {
	const output = [];

	for( let line of arrayInput ) {
		if( !/-->/.test(line) ) continue;

		output.push({
			from: line.split('-->')[0].trim(),
			to: line.split('-->')[1].split(':')[0].trim(),
			value: line.split('-->')[1].split(':')[1].trim(),
		})
	}

	return output;
}

function extractStatesFromTransitions(transitions) {
	const output = {};

	for( let transition of transitions ) {
		if( transition.from === '[*]' ) continue;

		const emptyState = {
			inners: {},
			outers: {},
			self: null,
			finalState: false,
		};

		const innerState = output[transition.from] ?? emptyState;

		if( transition.to === '[*]' ) innerState.finalState = true;

		if( transition.from === transition.to ) {
			innerState.self = transition.value;
		} else if( transition.to !== '[*]' ) {
			const outerState = output[transition.to] ?? emptyState;

			innerState.outers[transition.to] = transition.value;
			outerState.inners[transition.from] = transition.value;

			output[transition.to] = outerState;
		}

		output[transition.from] = innerState;
	}

	return output;
}

function calcTransitions(states) {
	Object.keys(states).forEach( state => {
		states[state].transitions = Object.keys(states[state].inners).length * Object.keys(states[state].outers).length;
	});

	return states;
}

function filterStatesWithLeastTransitions(states) {
	let leastTransitionsNumber = null;

	for( let state of Object.keys(states) ) {
		if( states[state].finalState ) {
			delete states[state];
			continue;
		}

		if( leastTransitionsNumber === null || states[state].transitions < leastTransitionsNumber ) {
			leastTransitionsNumber = states[state].transitions;
		}
	}

	Object.keys(states).forEach( state => {
		if( states[state].transitions !== leastTransitionsNumber ) delete states[state];
	})

	return states;
}