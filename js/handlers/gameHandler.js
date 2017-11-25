/**
 * Module containing all the function for handling the elements/event of the game tab
 * @module gameHandler
 */
var self = module.exports = {
	/**
	 * Initialize everything the tab need in order to run properly.
	 */
	init: () => {
		const instance = require('../Application')
		const Request = require('../Request')

		//The server is offline
		if (!instance.serverStatus) {
			$('#game-ui').hide()
			$('#game-something-went-wrong').append('<h1 class="display-1">Serveur hors ligne <i class="fa fa-exclamation-triangle" aria-hidden="true"></i></h1>').show()
		}
		//The synchronization is not done
		else if (instance.gameState == null) {
			$('#game-ui').hide()
			$('#game-something-went-wrong').append('<h1 class="display-1">Synchronization en cours <i class="fa fa-refresh fa-spin"></i></h1>').show()
		}
		//There's no game
		else if (instance.gameState.currentGame == -1) {
			$('.can-be-disabled').prop('disabled', true)
			var game_init_txt = "<h1 class=\"display-1\">Aucune partie en cours <i class=\"fa fa-exclamation-triangle\"></i></h1><br/>" +
					"<h3> Cliquez sur <span class=\"fa fa-plus\"></span> pour commencer une partie</h3>"
			$('#main-formule').append(game_init_txt)

			self.setAnimations()
		}
		else {
			//The game has been created client side but not server side
			if (instance.gameState.getCurrent().gameId == undefined)
				self.startNewGame()
			//The game has been created both client and server side
			else
				Request.buildRequest('RESUME', self.canResume).send('/' + instance.gameState.getCurrent().gameId)

			self.setAnimations()
		}
	},

	/**
	 * Function called when we unload the tab.
	 * Will stop all countdowns currently running.
	 */
	unload: () => {
		const instance = require('../Application')
		if (instance.gameState != null)
			instance.gameState.stopCountdown()
	},

	/**
	 * Set the events for the game tab.
	 * Only the mouse clicks events are working right now.
	 * @see {@link dragNDropHandler} for more informations.
	 */
	setEvents: () => {
		const mouseEventHandler = require('./mouseEventHandler')

		mouseEventHandler.setEvents()
		//DragNDropHandler.setEvents(obj)
	},

	/**
	 * Set the animations, displayed when the tab is loaded.
	 */
	setAnimations: (callback) => {
		$('.toolbar').show().animateCss('slideInLeft', 0.3, 0, () => {
			$('#main-content').show().animateCss('slideInLeft', 0.3)
			$('#timeline').show().animateCss('slideInUp', 0.3)
		})
	},

	/**
	 * Response of a 'RESUME' request, if the 'RESUME' request was a success will
	 * send a 'GAMESTATE' request to start the game.
	 * @param {Object} response response from the request (jQuery ajax response)
	 * @param {String} status response status from the request
	 * @throws will throw an error if the request failed
	 */
	canResume: (response, status) => {
		const instance = require('../Application')
		const Request = require('../Request')

		if (Request.checkError(response, status, '#gameNotification') === false)
			throw '[ERROR]: request response invalid, request might have failed.'

		Request.buildRequest('GAMESTATE', self.gameStartResponse).send('/' + instance.gameState.getCurrent().gameId)
	},

	/**
	 * Request used to start a new game, will ask the server to start a new game
	 * using the parameters contained in gameState to define the configuration of the
	 * game.
	 */
	startNewGame: () => {
		const instance = require('../Application')
		const Request = require('../Request')

		var request = Request.buildRequest('START', self.startNewGameResponse)

		request.send('/' + instance.gameState.getCurrent().mode + '/' + instance.gameState.getCurrent().ruleSet + '/' + instance.gameState.getCurrent().formulaId + '/' + instance.gameState.getCurrent().useTheorem)
	},

	/**
	 * Response of the 'START' request.
	 * If it's a success it will register the game ID and send a request to get the
	 * game state and start the game client side.
	 * @param {Object} response response from the request (jQuery ajax response)
	 * @param {String} status response status from the request
	 * @throws will throw an error if the request failed
	 */
	startNewGameResponse: (response, status) => {
		const instance = require('../Application')
		const Request = require('../Request')

		var o = Request.checkError(response, status, '#gameNotification')

		if (o === false)
			throw '[ERROR]: request response invalid, request might have failed.'

		instance.gameState.getCurrent().gameId = o.id

		var request = Request.buildRequest('GAMESTATE', self.gameStartResponse).send('/' + o.id)
	},

	/**
	 * Response of the request to get the game state after a new game is created.
	 * Will stop any timer currently running, and start a new timer if it's a
	 * 'NORMAL' game and delegate the processing of the response to
	 * gameUpdateMathResponse.
	 * @param {Object} response response from the request (jQuery ajax response)
	 * @param {String} status response status from the request
	 * @throws will throw an error if the request failed
	 */
	gameStartResponse: (response, status) => {
		const instance = require('../Application')
		const Request = require('../Request')

		var o = Request.checkError(response, status, '#gameNotification')

		if (o === false)
			throw '[ERROR]: request response invalid, request might have failed.'

		self.gameUpdateMathResponse(response, status)

		//Stop any timer currently running
		instance.gameState.stopCountdown()
		$('#game-timer').hide()
		$('#game-timer').tooltip('hide')

		//Start timer
		self.startTimer()
	},

	/**
	 * Send a request to get the game state.
	 * Stop any timer currently running and start a new one if it's a 'NORMAl'
	 * game.
	 */
	gameStateRequest: () => {
		const instance = require('../Application')
		const Request = require('../Request')

		var request = Request.buildRequest('GAMESTATE', self.gameUpdateMathResponse)

		request.send('/' + instance.gameState.getCurrent().gameId)

		//Stop any timer currently running
		instance.gameState.stopCountdown()
		$('#game-timer').hide()
		$('#game-timer').tooltip('hide')

		//Start timer
		self.startTimer()
	},

	/**
	 * Function that process the response from the server containing the game state.
	 * Will also check for VICTORY.
	 * @param {Object} response response from the request (jQuery ajax response)
	 * @param {String} status response status from the request
	 * @throws will throw an error if the request failed
	 */
	gameUpdateMathResponse: (response, status) => {
		const instance = require('../Application')
		const utils = require('../utils')
		const Request = require('../Request')

		var o = Request.checkError(response, status, '#gameNotification')

		if (o === false)
			throw '[ERROR]: request response invalid, request might have failed.'

		instance.gameState.getCurrent().currentState = o

		//Set new math
		$('#main-formule').hide('fast')
		$('#main-formule').html('')
		$('#main-formule').text(instance.gameState.getCurrent().currentState.math)

		//Update Timeline
		self.updateTimeline(instance.gameState.getCurrent().currentState.timeline)

		//Call mathJax typeset and show the formule once it's done
		utils.typesetMath(() => {
			$('#main-formule').show('fast')

			//Set events
			self.setEvents()

			instance.settings.applySettings()

			self.updateTimelineSize()
		})

		//Check for VICTORY
		if ((o.gameStatus == 'VICTORY') && (instance.gameState.getCurrent().mode == 'NORMAL')) {
			$('#game-timer').hide()
			$('#game-timer').tooltip('hide')
			instance.gameState.getCurrent().countdown.stopCountdown()
			var elapsedTime = instance.gameState.getCurrent().countdown.timeElapsed()
			instance.displayPopup('Victoire', 'Bravo, vous avez résolu la formule en ' + elapsedTime + ' minutes', 'Accueil', 'Recommencer',
			() => {
				instance.gameState.delete(instance.gameState.getCurrent().gameId)
				instance.requestHtml('HOME')
				$('#popup').modal('hide')
			}, () => {
				self.restartGame()
				$('#popup').modal('hide')
			}, () => {
				if (instance.gameState.getCurrent() && instance.gameState.getCurrent().currentState && instance.gameState.getCurrent().currentState.gameStatus == 'VICTORY') {
					instance.gameState.delete(instance.gameState.getCurrent().gameId)
					instance.requestHtml('GAME')
				}
			})
			Request.buildRequest('DELETE').send('/' + instance.gameState.getCurrent().gameId)
		}
	},

	/**
	 * Send a request to the server to apply a rule to the formula.
	 * Call gameUpdateMathResponse to process the response.
	 * @param {Event} event jQuery Event object
	 */
	gameRuleRequest: (event) => {
		const instance = require('../Application')
		const Request = require('../Request')

		event.stopPropagation()

		var request = Request.buildRequest('APPLYRULE', self.gameUpdateMathResponse)
		request.send('/' + instance.gameState.getCurrent().gameId + '/' + event.data.value.expId + '/' + event.data.value.ruleId + '/' + event.data.value.context)

		if ($('#tooltip').is(':visible'))
			$('#tooltip').hide(100)
	},

	/**
	 * Function handling the end of the countdown.
	 * When the countdown is over a 'DELETE' request is send to the server
	 * to signal the game is over.
	 * When the request is over call gameOverResponse to handle the end of the game
	 * clientside.
	 */
	timerOnOver: () => {
		const instance = require('../Application')
		const Request = require('../Request')

		//Clear timer text
		$('#game-timer').hide()
		$('#game-timer').tooltip('hide')

		instance.displaySuccessNotification('#gameNotification', 'Temps écouler, partie finie.')

		Request.buildRequest('DELETE', self.gameOverResponse).send('/' + instance.gameState.getCurrent().gameId)
	},

	/**
	 * Function handling the end of the game clientside, will display a popup.
	 * @param {Object} response response from the request (jQuery ajax response)
	 * @param {String} status response status from the request
	 * @throws will throw an error if the request failed
	 */
	gameOverResponse: (response, status) => {
		const instance = require('../Application')
		const Request = require('../Request')

		if (Request.checkError(response, status, '#gameNotification') === false)
			throw '[ERROR]: request response invalid, request might have failed.'

		instance.displayPopup('Défaite', 'Temps écouler, vous avez perdu !', 'Accueil', 'Recommencer',
		() => {
			instance.gameState.delete(instance.gameState.getCurrent().gameId)
			instance.requestHtml('HOME')
			$('#popup').modal('hide')
		}, () => {
			self.restartGame()
			$('#popup').modal('hide')
		}, () => {
			if (instance.gameState.getCurrent() && instance.gameState.getCurrent().countdown && instance.gameState.getCurrent().countdown.state == 'OVER') {
				instance.gameState.delete(instance.gameState.getCurrent().gameId)
				instance.requestHtml('GAME')
			}
		})
	},

	/**
	 * Function handling the update of the countdown.
	 * Will update the text box.
	 * @param {Countdown} countdown countdown object
	 */
	timerOnUpdate: (countdown) => {
		$('#game-timer').tooltip('show')
		$('#game-timer').attr('data-original-title', 'Temps restant : ' + countdown.toString())
	},

	/**
	 * Function handling the restart button.
	 * Send an 'DELETE' request then send a 'START' request using the default handler for
	 * those request.
	 */
	restartGame: () => {
		const instance = require('../Application')
		const Request = require('../Request')

		instance.gameState.stopCountdown()
		instance.gameState.getCurrent().countdown = null
		instance.gameState.getCurrent().currentState = null

		Request.buildRequest('DELETE', self.startNewGame).send('/' + instance.gameState.getCurrent().gameId)
	},

	/**
	 * Request the previous state of the game.
	 */
	previousState: () => {
		const instance = require('../Application')
		const Request = require('../Request')

		Request.buildRequest('PREVIOUS', self.gameUpdateMathResponse).send('/' + instance.gameState.getCurrent().gameId)
	},

	/**
	 * Request the next state of the game.
	 */
	nextState: () => {
		const instance = require('../Application')
		const Request = require('../Request')

		Request.buildRequest('NEXT', self.gameUpdateMathResponse).send('/' + instance.gameState.getCurrent().gameId)
	},

	/**
	 * Toggle the display of the timeline.
	 */
	toggleTimeline: () => {
		if ($('#hideTimeline').is(':visible')) {
			$('#hideTimeline').hide()
			$('#showTimeline').show().css('display', 'flex')

			$('#timeline').animateCss('slideOutDown', 0.2, 0, () => {
				$('#timeline-elements').hide()
			})
		}
		else {
			$('#hideTimeline').show().css('display', 'flex')
			$('#showTimeline').hide()

			$('#timeline-elements').show()
			$('#timeline').animateCss('slideInUp', 0.2, 0)
		}
	},

	/**
	 * Update the content of the timeline.
	 * Called each time the current game update.
	 * @param {Object} timeline timeline object from the gameState object
	 */
	updateTimeline: (timeline) => {
		$('#timeline-elements').html('')

		for (var i = timeline.elements.length-1 ; i >= 0 ; i--) {
			var elem
			if (i == timeline.current)
				elem = $('<div></div>').addClass('timeline-element current-element btn btn-danger').text(timeline.elements[i].text)
			else
				elem = $('<div></div>').addClass('timeline-element btn btn-info').text(timeline.elements[i].text)

			elem.click({ param: i }, self.timelineOnClickHandler)

			$('#timeline-elements').append(elem)
		}
	},

	/**
	 * Update the size of the timeline.
	 * If the desired height of the timeline is smaller than half the screen height
	 * it will become the new size, otherwise it will be half the screen size, this
	 * way the timeline can adapt it's size depending on the height of the MathJax
	 * elements but never be higher than half the screen.
	 * By default the timeline size is 90px and 60px for the elements, then there's
	 * 32px of margin from MathJax and 30px of margin from the timeline-element
	 * (10px top and 20px bottom)
	 */
	updateTimelineSize: () => {
		var screenHeight = $(document).height()
		var max = 0
		$('.timeline-element > .mjx-chtml').each(function () {
			if ($(this).height() > max)
				max = $(this).height()
		})

		if ((max + 32 + 30 + 40) <= (screenHeight/ 2))
			height = max + 32
		else
			height = (screenHeight / 2) - 40

		$('.timeline-element').height(height)
		$('#timeline-elements').height(height + 30)
	},

	/**
	 * Handler for the 'click' event for the elements of the timeline.
	 * Depending on if the game is in theorem mode or not the handler for the
	 * onclick event differ.
	 * @param {Event} event Jquery event object
	 */
	timelineOnClickHandler: (event) => {
		if ($('#addTheorem').is(':visible'))
			self.requestStateFromTimeline(event.data.param)
		else
			self.selectForTheorem(event.data.param, event.currentTarget)
	},

	/**
	 * Reqest the gameState of the index state.
	 * @param {int} index Number of the state requested.
	 */
	requestStateFromTimeline: (index) => {
		const instance = require('../Application')
		const Request = require('../Request')

		Request.buildRequest('TIMELINE', self.gameUpdateMathResponse).send('/' + instance.gameState.getCurrent().gameId + '/' + index)
	},

	/**
	 * Object containing the index for the theorem creation.
	 * Is always null expect if timeline elements are selectionned for theorem
	 * creation.
	 */
	theoremSelection: { start: null, end: null},

	/**
	 * Toggle the timeline between the theorem mode and 'history' mode.
	 * When in theorem mode you can't hide the timeline and if the timeline was
	 * hiddden it will be showed automatically.
	 * Will also clear theoremSelection each time this function is called.
	 */
	toggleCreateTheorem: () => {
		const instance = require('../Application')

		if ($('#addTheorem').is(':visible')) {
			$('#addTheorem').hide()

			if ($('#timeline-elements').is(':hidden'))
				self.toggleTimeline()

			$('#hideTimeline').hide()

			$('#validTheorem').show().css('display', 'flex')
			$('#cancelTheorem').show().css('display', 'flex')
		}
		else {
			$('#addTheorem').show().css('display', 'flex')

			$('#hideTimeline').show().css('display', 'flex')

			$('#validTheorem').hide()
			$('#cancelTheorem').hide()

			$('.timeline-element').each(function () {
				$(this).removeClass('btn-warning')
				if ($(this).hasClass('current-element'))
					$(this).addClass('btn-danger')
				else
					$(this).addClass('btn-info')
			})
		}

		self.theoremSelection.start = null
		self.theoremSelection.end = null
	},

	/**
	 * Will select for the theorem creation the target element.
	 * If the target is already selected will unselect it.
	 * If not the target is added in the theoremSelection object.
	 * @param {int} index Number of the state clicked.
	 * @param {Object} target DOM element of the event target.
	 */
	selectForTheorem: (index, target) => {
		const instance = require('../Application')

		//If we click on an already selectionned item we unselect it
		if (self.theoremSelection.start == index) {
			self.theoremSelection.start = null
			$(target).removeClass('btn-warning')
			if ($(target).hasClass('current-element'))
				$(target).addClass('btn-danger')
			else
				$(target).addClass('btn-info')
		}
		else if (self.theoremSelection.end == index) {
			self.theoremSelection.end = null
			$(target).removeClass('btn-warning')
			if ($(target).hasClass('current-element'))
				$(target).addClass('btn-danger')
			else
				$(target).addClass('btn-info')
		}
		//Else we first select the starting point then the end one
		else if (self.theoremSelection.start == null) {
			self.theoremSelection.start = index
			$(target).addClass('btn-warning')
			if ($(target).hasClass('current-element'))
				$(target).removeClass('btn-danger')
			else
				$(target).removeClass('btn-info')
		}
		else if (self.theoremSelection.end == null) {
			self.theoremSelection.end = index
			$(target).addClass('btn-warning')
			if ($(target).hasClass('current-element'))
				$(target).removeClass('btn-danger')
			else
				$(target).removeClass('btn-info')
		}
	},

	/**
	 * Check for the creation of the theorem. Will display a popup with either a
	 * Error message or a success message and ask the user if he want to process
	 * with the theorem creation.
	 */
	validTheorem: () => {
		const instance = require('../Application')

		if (self.theoremSelection.start > self.theoremSelection.end) {
			var tmp = self.theoremSelection.start
			self.theoremSelection.start = self.theoremSelection.end
			self.theoremSelection.end = tmp
		}

		if ((self.theoremSelection.start == null) || (self.theoremSelection.end == null))
			instance.displayPopup('Création d\'un théorème', 'L\' une des 2 valeurs n\'est pas selectionné.', 'OK', '', () => { $('#popup').modal('hide') })
		else
			instance.displayPopup('Création d\'un théorème', 'Voulez-vous créer ce théorème ?', 'Oui', 'Annuler', self.sendTheoremCreation, () => { $('#popup').modal('hide') })
	},

	/**
	 * Send a 'CREATETHEOREM' request then toggle off the theorem mode and hide
	 * the popup.
	 */
	sendTheoremCreation: () => {
		const instance = require('../Application')
		const Request = require('../Request')

		Request.buildRequest('CREATETHEOREM').send('/' + instance.gameState.getCurrent().gameId + '/' + self.theoremSelection.start + '/' + self.theoremSelection.end)

		self.toggleCreateTheorem()
		$('#popup').modal('hide')
	},

	/**
	 * Toggle the rules list.
	 * If hidden will send a request 'RULESLIST' and display the list container.
	 * If visible will hide the list container
	 */
	toggleRulesList: () => {
		const instance = require('../Application')
		const Request = require('../Request')

		if ($('#rules-list').is(':hidden')) {
			Request.buildRequest('RULESLIST', self.rulesListReply).send('/' + instance.gameState.getCurrent().gameId)

			$('#rules-list').animateCss('slideInDown', 0.3)
			$('#rules-list').show()
			$('#rules-loader').show()
		}
		else {
			$('#rules-list').animateCss('slideOutUp', 0.3, 0, () => {
				$('#rules-list').hide()
				$('#rules-content').hide()
			})
		}

	},

	/**
	 * Response to the 'RULESLIST' request.
	 * Call displayRulesList to display the rules list with the JSON Object
	 * received from the request.
	 * @param {Object} response response from the request (jQuery ajax response)
	 * @param {String} status response status from the request
	 * @throws will throw an error if the request failed
	 */
	rulesListReply: (response, status) => {
		const instance = require('../Application')
		const Request = require('../Request')

		var o = Request.checkError(response, status, '#gameNotification')

		if (o === false)
			throw '[ERROR]: request response invalid, request might have failed.'

		self.displayRulesList(o.rules)
	},

	/**
	 * Build the rules list and displays it.
	 * @param {Object} rules JSON object containing all the rules.
	 */
	displayRulesList: (rules) => {
		$('#rules-content').html('')

		for (var item in rules) {
			for (var type in rules[item]) {
				var title = $('<h1></h1>').addClass('display-3').text(type)
				$('#rules-content').append(title)
				for (var rule in rules[item][type]) {
					var elem = $('<div></div>').addClass('notif alert alert-info').text(rules[item][type][rule])
					$('#rules-content').append(elem)
				}
			}
		}

		$('#rules-loader').hide()
		utils.typesetMath(() => { $('#rules-content').show('fast') }, 'rules-content')
	},

	/**
	 * Handler for the synchronize button onclick event.
	 * Will start a synchronization and reload the 'GAME' tab.
	 */
	synchronize: () => {
		const instance = require('../Application')

		instance.synchronize()
		instance.requestHtml('GAME')
	},

	/**
	 * Function sending a 'DELETE' request to delete a game.
	 * If no index specified, will delete the current game, otherwise will
	 * delete the game index.
	 * The function will also stop any countdown and reload the 'GAME' tab.
	 * @param {Event} [event] jQuery Event object
	 * @param {int} [index] index of the game to be deleted
	 */
	deleteGame: (event, index) => {
		const instance = require('../Application')
		const Request = require('../Request')

		if (event != undefined)
			event.stopPropagation()

		var gameId

		if (index && typeof index === 'number')
			gameId = instance.gameState.array[index].gameId
		else
			gameId = instance.gameState.getCurrent().gameId

		//Stop any timer currently running
		instance.gameState.stopCountdown()
		$('#game-timer').hide()
		$('#game-timer').tooltip('hide')

		Request.buildRequest('DELETE').send('/' + gameId)

		instance.gameState.delete(gameId)

		instance.gameState.updateCurrent()

		instance.requestHtml('GAME')
	},
	
	/**
	 * Function who asks confirmation before delete game
	 * */
	askToDelete: () => {
		//$('#main-formule').append('<div id="confirmOverlay"><div id="confirmBox"><h1>Title of the confirm dialog</h1><p>Description of what is about to happen</p><div id="confirmButtons"><a class="button blue" href="#">Yes<span></span></a><a class="button gray" href="#">No<span></span></a></div></div></div>')
		$.confirm({
			columnClass: 'col-md-10 col-md-offset-2',
		    title: 'Confirm!',
		    content: 'Simple confirm!',
		    buttons: {
		        confirm: function () {
		            self.deleteGame()
		        },
		        cancel: function () {
		            $.alert('Canceled!');
		        },
		    }
		});
	},


	/**
	 * This function start a new countdown if the current game is a 'NORMAL' game.
	 * If no countdown existed will create a new one, if the countdown present was
	 * the serialized form, will create a new countdown using the serialized form,
	 * if a countdown was present will resume it if it's not over in which case the
	 * function will throw an error.
	 * @throws Will throw an error if the countdown is already over
	 */
	startTimer: () => {
		const instance = require('../Application')
		const Countdown = require('../Countdown')

		var current = instance.gameState.getCurrent()

		if (current.mode == 'NORMAL') {
			
			if (current.countdown == null)
				current.countdown = new Countdown (Countdown.minutesToMilliseconds(2), self.timerOnOver, self.timerOnUpdate)

			else if (current.countdown.state	== null)
				current.countdown = new Countdown (current.countdown.duration, self.timerOnOver, self.timerOnUpdate, current.countdown.remainingTime)

			else if (current.countdown.state == 'OVER') {
				instance.displayErrorNotification('#gameNotification', 'Le timer est fini, la partie est donc fini et devrait être supprimer ou recommencer.')
				throw '[ERROR]: Countdown is over game should be deleted or restarted'
			}

			current.countdown.startCountdown()

			instance.gameState.getCurrent().countdown = current.countdown

			$('#game-timer').show()
			$('#game-timer').tooltip('show')
		}
	},
	
	/**
	 * Timer pause
	 * */
	pauseTimer: () => {
		const instance = require('../Application')
		const Countdown = require('../Countdown')

		var current = instance.gameState.getCurrent()
		
		if(current.mode == 'NORMAL'){
			if(current.countdown.state == 'STARTED'){
				$('#main-formule').hide('fast')
			}else{
				$('#main-formule').show('fast')
			}
			current.countdown.pauseCountdown()
		}
	},

	/**
	 * Toggle the display of the game list.
	 * Will call buildGameList for the creation of the list.
	 */
	toggleGameList: () => {
		if ($('#game-list').is(':hidden')) {
			$('#game-list').animateCss('slideInDown', 0.3)
			$('#game-list').show()
			$('#game-list-content').hide()
			self.buildGameList()
		}
		else {
			$('#game-list').animateCss('slideOutUp', 0.3, 0, () => {
				$('#game-list').hide()
			})
		}
		$('[data-toggle="tooltip"]').tooltip('hide')
	},

	/**
	 * Function responsible for the creation of the game list.
	 */
	buildGameList: () => {
		const instance = require('../Application')
		const utils = require('../utils')

		$('#game-list-content').html('')

		for (var i in instance.gameState.array) {
			var elem = $('<div></div>')
			if (i == instance.gameState.currentGame) {
				if (instance.gameState.array[i].mode == 'NORMAL')
					elem.append('<div><i class="fa fa-long-arrow-right fa-fw text-info"></i><a onclick="require(\'./js/handlers/gameHandler\').deleteGame(event,' + i + ')" class="text-danger"><i class="fa fa-trash fa-fw" aria-hidden="true"></i></a>' + instance.gameState.array[i].mode + ' -> Temps restant : ' + instance.gameState.array[i].countdown + ' </div>')
				else
					elem.append('<div><i class="fa fa-long-arrow-right fa-fw text-info"></i><a onclick="require(\'./js/handlers/gameHandler\').deleteGame(event,' + i + ')" class="text-danger"><i class="fa fa-trash fa-fw" aria-hidden="true"></i></a>' + instance.gameState.array[i].mode + '</div>')
			}
			else {
				if (instance.gameState.array[i].mode == 'NORMAL')
					elem.append('<div><a onclick="require(\'./js/handlers/gameHandler\').deleteGame(event,' + i + ')" class="text-danger"><i class="fa fa-trash fa-fw" aria-hidden="true"></i></a>' + instance.gameState.array[i].mode + ' -> Temps restant : ' + instance.gameState.array[i].countdown + ' </div>')
				else
					elem.append('<div><a onclick="require(\'./js/handlers/gameHandler\').deleteGame(event,' + i + ')" class="text-danger"><i class="fa fa-trash fa-fw" aria-hidden="true"></i></a>' + instance.gameState.array[i].mode + '</div>')
			}

			if (instance.gameState.array[i].useTheorem)
				elem.append('Avec théorème')
			else
				elem.append('Sans théorème')

			if (instance.gameState.array[i].currentState != null)
				elem.append('<div>' + instance.gameState.array[i].currentState.timeline.elements[instance.gameState.array[i].currentState.timeline.current].text + '</div>')
			else
				elem.append('<div>' + instance.gameState.array[i].formulaLatex + '</div>')

			elem.addClass('game-select-element')

			elem.on('click', {index: i},(event) => {
				instance.gameState.currentGame = event.data.index
				self.gameStateRequest()
				self.toggleGameList()
			})

			$('#game-list-content').append(elem)
			$('#game-list-content').append('<hr class="white-hr"></hr>')
		}

		utils.typesetMath(() => {
			$('#game-list-content').show('fast')
		}, 'game-list-content')
	},
}
