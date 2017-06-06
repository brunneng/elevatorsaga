{

    init: function (elevators, floors) {

        // GLOBALS
        currentTime = 0.0;
        lastDestinationsUpdated = 0.0;

        // CONSTANTS
        var FULL_ELEVATOR_LOAD_FACTOR = 0.6;
        var MAX_LOAD_FACTOR_TO_TAKE_FELLOW_TREVELLERS = elevators.length > 2 ? 0.25 : FULL_ELEVATOR_LOAD_FACTOR;
        var SCORE_BUST_FACTOR = 1;

        var peopleUpPressed = [];
        var peopleDownPressed = [];

        var lastTimeUpPressed = [];
        var lastTimeDownPressed = [];
        var totalPeopleTakenOnFloorCount = [];
        var totalPeopleTaken = 0;

        var clone = function (array) {
            return array.slice(0);
        };

        var removeValues = function (array, value) {
            var stop = false;
            while (!stop) {
                var index = array.indexOf(value);
                if (index >= 0) {
                    array.splice(index, 1);
                }
                else {
                    stop = true;
                }
            }
        };

        var containsValue = function (array, value) {
            return array.indexOf(value) >= 0;
        };

        var clearQueueAndMoveToFloor = function (elevator, floorNum) {
            elevator.destinationQueue = [];
            elevator.destinationQueue.push(floorNum);
            elevator.checkDestinationQueue();
            elevator.lastTimeMoveScheduled = currentTime;
        };

        var getNextFloorToUnload = function (elevator) {
            var moveFromFloor = elevator.currentFloor();
            var sortedFloors = clone(elevator.peopleInsidePressed);
            sortedFloors.sort();
            if (elevator.stopped) {
                removeValues(sortedFloors, moveFromFloor);
            }

            if (sortedFloors.length === 0) {
                return undefined;
            }

            var mostDownFloor = sortedFloors[0];
            var maxDistFromDown = -1;
            if (moveFromFloor > mostDownFloor) {
                maxDistFromDown = moveFromFloor - mostDownFloor;
            }

            var mostUpFloor = sortedFloors[sortedFloors.length - 1];
            var maxDistFromUp = -1;
            if (moveFromFloor < mostUpFloor) {
                maxDistFromUp = mostUpFloor - moveFromFloor;
            }
            var moveDown = false;
            if (maxDistFromDown === -1 && maxDistFromUp > 0) {
                moveDown = false;
            }
            else if (maxDistFromDown > 0 && maxDistFromUp === -1) {
                moveDown = true;
            }
            else {
                moveDown = maxDistFromDown < maxDistFromUp;
            }

            var res = undefined;
            for (var i in sortedFloors) {
                var floorNum = sortedFloors[i];
                if (moveDown && floorNum <= moveFromFloor) {
                    if (res == null || floorNum > res) {
                        res = floorNum;
                    }
                }
                else if (floorNum >= moveFromFloor) {
                    if (res == null || floorNum < res) {
                        res = floorNum;
                    }
                }
            }

            return res;
        };

        var setNextGoUp = function (elevator) {
            elevator.goingUpIndicator(true);
            elevator.goingDownIndicator(false);
        };

        var setNextGoDown = function (elevator) {
            elevator.goingUpIndicator(false);
            elevator.goingDownIndicator(true);
        };

        var hasPressedFloorsBelow = function (pressedFloorNums, targetFloor) {
            return pressedFloorNums.find(function (e) {
                return e < targetFloor;
            })
        };

        var hasPressedFloorsAbove = function (pressedFloorNums, targetFloor) {
            return pressedFloorNums.find(function (e) {
                return e > targetFloor;
            })
        };

        var updateAllElevatorsDestinations = function () {
            lastDestinationsUpdated = currentTime;

            var freeElevators = clone(elevators);

            var createTakePeopleTask = function (floorNum, moveDown) {
                var lastTimePressed = moveDown ? lastTimeDownPressed[floorNum] : lastTimeUpPressed[floorNum];
                var timeSincePress = currentTime - lastTimePressed;
                var timeFactor = 0.01 * timeSincePress * timeSincePress;

                var popularFloorFactor = (5 + totalPeopleTakenOnFloorCount[floorNum]) / (1 + totalPeopleTaken);
                var score = (popularFloorFactor * timeFactor);

                return {
                    floorNum: floorNum,
                    moveDown: moveDown,
                    score: score,
                    used: false
                };
            };

            var takePeopleTasks = [];
            for (var i_f in peopleUpPressed) {
                var floorNum = parseInt(i_f);
                if (peopleUpPressed[floorNum]) {
                    takePeopleTasks.push(createTakePeopleTask(floorNum, false));
                }

                if (peopleDownPressed[floorNum]) {
                    takePeopleTasks.push(createTakePeopleTask(floorNum, true));
                }
            }

            var scoreBoost = [];
            for (var i_t1 in takePeopleTasks) {
                var task1 = takePeopleTasks[i_t1];
                scoreBoost[i_t1] = 0;
                for (var i_t2 in takePeopleTasks) {
                    var task2 = takePeopleTasks[i_t2];
                    if ((task1.floorNum > task2.floorNum && task1.moveDown) ||
                        (task1.floorNum < task2.floorNum && !task1.moveDown)) {
                        var dist = Math.sqrt(Math.abs(task1.floorNum - task2.floorNum) + 1);
                        scoreBoost[i_t1] += (SCORE_BUST_FACTOR*task2.score / dist);
                    }
                }
            }
            for (var i_t in takePeopleTasks) {
                var task = takePeopleTasks[i_t];
                task.score += scoreBoost[i_t];
            }

            var formatTask = function(task) {
                return "" + task.floorNum + ", " + (task.moveDown ? "down" : "up") + " = " + task.score;
            };

            var tasksPerElevator = [];
            for (var i_t in takePeopleTasks) {
                var task = takePeopleTasks[i_t];
                console.log(formatTask(task));

                var floorNum = task.floorNum;
                for (var i_e in freeElevators) {
                    var elevator = freeElevators[i_e];

                    if (elevator.loadFactor() > FULL_ELEVATOR_LOAD_FACTOR) {
                        continue;
                    }

                    if (elevator.peopleInsidePressed.length > 0) {
                        if (elevator.loadFactor() > MAX_LOAD_FACTOR_TO_TAKE_FELLOW_TREVELLERS) {
                            continue;
                        }

                        var floorToUnloadNum = getNextFloorToUnload(elevator);
                        var elevatorIsSuitable = false;
                        var currFloorNum = elevator.currentFloor();
                        var moveDown = task.moveDown;
                        if (moveDown && floorNum <= currFloorNum && floorNum > floorToUnloadNum) {
                            elevatorIsSuitable = true;
                        }
                        else if (!moveDown && floorNum >= currFloorNum && floorNum < floorToUnloadNum) {
                            elevatorIsSuitable = true;
                        }

                        if (!elevatorIsSuitable) {
                            continue;
                        }
                    }

                    var loadFactor = elevator.loadFactor() + 0.1;
                    //loadFactor = loadFactor*loadFactor;
                    var dist = 1 + Math.abs(elevator.currentFloor() - task.floorNum);
                    var distFactor = dist * dist;
                    var elevatorScore = task.score / (loadFactor * distFactor);
                    tasksPerElevator.push({
                        elevator: elevator,
                        task: task,
                        elevatorScore: elevatorScore
                    });
                }
            }

            tasksPerElevator.sort(function (task1, task2) {
                if (task1.elevatorScore < task2.elevatorScore) {
                    return 1;
                }
                return -1;
            });

            for (var i_t in tasksPerElevator) {
                if (freeElevators.length === 0) {
                    break;
                }

                var elevatorTask = tasksPerElevator[i_t];
                //console.log(elevatorTask.elevator.index + " [" + formatTask(elevatorTask.task) + "] = " + elevatorTask.elevatorScore);

                var task = elevatorTask.task;
                if (task.used) {
                    continue;
                }
                task.used = true;

                var elevator = elevatorTask.elevator;
                if (!containsValue(freeElevators, elevator)) {
                    continue;
                }

                if (task.moveDown) {
                    setNextGoDown(elevator);
                }
                else {
                    setNextGoUp(elevator);
                }

                //console.log(currentTime + ") take: elevator = " + elevator.index + " move to floor = " + task.floorNum);
                clearQueueAndMoveToFloor(elevator, task.floorNum);
                removeValues(freeElevators, elevator);
            }
            for (var i_e in freeElevators) {
                var elevator = freeElevators[i_e];

                if (elevator.peopleInsidePressed.length > 0) {
                    var floorToUnloadNum = getNextFloorToUnload(elevator);
                    var moveDown = floorToUnloadNum < elevator.currentFloor();
                    if (moveDown && hasPressedFloorsBelow(elevator.peopleInsidePressed, floorToUnloadNum)) {
                        setNextGoDown(elevator);
                    }
                    if (!moveDown && hasPressedFloorsAbove(elevator.peopleInsidePressed, floorToUnloadNum)) {
                        setNextGoUp(elevator);
                    }
                    //console.log(currentTime + ") unload: elevator = " + elevator.index + " move to floor = " + floorToUnloadNum);
                    clearQueueAndMoveToFloor(elevator, floorToUnloadNum);
                }
                else {
                    elevator.stop();
                }
            }
        };


        for (var i_e in elevators) {
            var elevator = elevators[i_e];
            elevator.index = parseInt(i_e);
            elevator.peopleInsidePressed = [];
            elevator.lastTimeMoveScheduled = 0;

            elevator.on("floor_button_pressed", function (floorNum) {
                var elevator = this;
                elevator.peopleInsidePressed.push(floorNum);
                updateAllElevatorsDestinations();

                totalPeopleTakenOnFloorCount[elevator.currentFloor()]++;
                totalPeopleTaken++;
            });

            elevator.on("stopped_at_floor", function (floorNum) {
                var elevator = this;

                removeValues(elevator.peopleInsidePressed, floorNum);
                elevator.stopped = true;
                updateAllElevatorsDestinations();
                elevator.stopped = false;

                if (elevator.goingUpIndicator()) {
                    peopleUpPressed[floorNum] = false;
                }
                if (elevator.goingDownIndicator()) {
                    peopleDownPressed[floorNum] = false;
                }

            });
        }

        for (var i_f in floors) {
            var floor = floors[i_f];
            var floorNum = floor.floorNum();
            peopleUpPressed[floorNum] = false;
            peopleDownPressed[floorNum] = false;
            totalPeopleTakenOnFloorCount[floorNum] = 0;

            floor.on("up_button_pressed", function () {
                var floorNum = this.floorNum();
                peopleUpPressed[floorNum] = true;
                lastTimeUpPressed[floorNum] = currentTime;

                updateAllElevatorsDestinations();

            });
            floor.on("down_button_pressed", function () {
                var floorNum = this.floorNum();
                peopleDownPressed[floorNum] = true;
                lastTimeDownPressed[floorNum] = currentTime;

                updateAllElevatorsDestinations();
            });
        }
    },
    update: function (dt, elevators, floors) {
        // We normally don't need to do anything here
        currentTime += dt;
    }
}