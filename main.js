import fs from 'node:fs/promises';
import inquirer from 'inquirer';

// Execute script
main();

/**
 * FUNCTIONS
 */
async function main() {
	const runDate = new Date();
	const outputFolderName = `${runDate.getDate()}-${runDate.getMonth() + 1}-${runDate.getFullYear()}-${runDate.getHours()}${runDate.getMinutes()}${runDate.getSeconds()}`;

	const fileLines = await readFileLines('./input.mmd');
	const transitions = extractTransitionsFromInput(fileLines);
	const states = extractStatesFromTransitions(transitions);

	let stepCounter = 0;
	const finalState = await ripState(states, stepCounter, outputFolderName);
	console.log('The RegEx is:', `^(${finalState[Object.keys(finalState)[0]].self})+$`)
}

async function readFileLines(filePath) {
	const input = await fs.readFile(filePath, 'utf8');
	return input.split('\r\n').map( line => line.trim() );
}

function extractTransitionsFromInput(arrayInput) {
	const output = [];

	for( const line of arrayInput ) {
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

	for( const transition of transitions ) {
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

	const filteredStates = JSON.parse(JSON.stringify(calcTransitions(states)));

	for( const state of Object.keys(filteredStates) ) {
		if( filteredStates[state].finalState ) {
			delete filteredStates[state];
			continue;
		}

		if( leastTransitionsNumber === null || filteredStates[state].transitions < leastTransitionsNumber ) {
			leastTransitionsNumber = filteredStates[state].transitions;
		}
	}

	Object.keys(filteredStates).forEach( state => {
		if( filteredStates[state].transitions !== leastTransitionsNumber ) delete filteredStates[state];
	})

	return filteredStates;
}

async function ripState(states, stepCounter, outputFilePath) {
	const newStates = JSON.parse(JSON.stringify(states));
	const filteredStates = filterStatesWithLeastTransitions(newStates);
	const filteredStatesArray = Object.keys(filteredStates);

	if( filteredStatesArray.length === 0 ) {
		return states;
	}

	const stateToRip = filteredStatesArray.length === 1 
		? filteredStatesArray[0] 
		: await askWhichStateRip(filteredStatesArray).stateToRip;

	const inners = Object.keys(filteredStates[stateToRip].inners);
	const outers = Object.keys(filteredStates[stateToRip].outers);
	const self = filteredStates[stateToRip].self;

	for( const inner of inners ) {
		for( const outer of outers ) {

			if( inner === outer ) {
				let newSelf = newStates[inner].self ? `(${newStates[inner].self})|` : '';

				newSelf += '(';
				newSelf += `(${filteredStates[stateToRip].inners[inner]})`;
				if( self ) newSelf += `(${self})*`;
				newSelf += `(${filteredStates[stateToRip].outers[outer]})`;
				newSelf += ')';

				newStates[inner].self = newSelf;
				delete newStates[inner].inners[stateToRip];
				delete newStates[inner].outers[stateToRip];
				continue;
			}

			let newTransition = newStates[inner].outers[outer] ? `(${newStates[inner].outers[outer]})|` : '';

			newTransition += '(';
			newTransition += `(${newStates[inner].outers[stateToRip]})`;
			if( self ) newTransition += `(${self})*`;
			newTransition += `(${newStates[outer].inners[stateToRip]})`;
			newTransition += ')';
			
			newStates[inner].outers[outer] = newTransition;
			newStates[outer].inners[inner] = newTransition;
			delete newStates[inner].outers[stateToRip];
			delete newStates[outer].inners[stateToRip];

		}
	}

	delete newStates[stateToRip];

	// Print newStates as separate *.mmd file as log of the step result
	stepCounter++;
	await printMermaidFile(newStates, stepCounter, stateToRip, outputFilePath);

	// Recurse
	return ripState(newStates, stepCounter, outputFilePath);
}

function askWhichStateRip(filteredStatesArray) {
	return inquirer.prompt([
		{
			type: 'list',
			name: 'stateToRip',
			message: 'Choice the state to rip',
			choices: filteredStatesArray
		}
	]);
}

async function printMermaidFile(states, stepCounter, stateToRip, outputFolder) {
	const dirPath = `./output/${outputFolder}`;
	const filePath = `${dirPath}/step${stepCounter}-rip${stateToRip}.mmd`;

	await fs.access(dirPath).catch(async () => {
			await fs.mkdir(dirPath);
		});

	const mermaidHeader = "stateDiagram-v2\n" + "	direction LR\n";
	await fs.writeFile(filePath, mermaidHeader, { flag: 'w+' });

	const statesArray = Object.keys(states);

	for( const stateKey of statesArray ) {
		const state = states[stateKey];
		const outers = Object.keys(state.outers);

		for( const outer of outers ) {
			await fs.writeFile(
				filePath,
				`	${stateKey} --> ${outer}: ${state.outers[outer]}\n`,
				{ flag: 'a' }
			);
		}

		if( state.self ) {
			await fs.writeFile(
				filePath,
				`	${stateKey} --> ${stateKey}: ${state.self}\n`,
				{ flag: 'a' }
			);
		}
	}

}