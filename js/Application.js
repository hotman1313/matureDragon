//TODO: mouseEvent => left or right click, display or not tooltip. game => possibility to play more than one game at a time

/**
 * Class controlling the different tab of the application.
 * The application is divided in 3 (4 counting the doc) 'tab'.
 * This class is used to switch between tab and to initialize everything the tabs
 * need in order to run.
 * Can be considered as the 'main' object running the application.
 * @property {Object} remote Allow the use of module from the main process in the renderer process
 * @property {Settings} settings Settings of the application
 * @property {String} currentTab String containing the name of the tab currently loaded
 * @property {module} handler Module handling the current tab
 * @property {jQuery} tabContainer DOM element on which the tab is append to
 * @property {Array} windows Array of BrowserWindow containing all the windows of the app (app & doc)
 * @property {jQuery} loader DOM element used to display while the tab is being loaded
 * @property {GameState} gameState Object containing all the informations on the state of the game
 * @property {Countdown} countdown Countdown object of the game (used to keep an eye on the countdown and not having multiple wountdown running at the same time)
 * @property {Notification[]} notifLog Log of all the notifications issued since the start of the app
 * @property {Application} instance Reference to the only instance of Application
 */
class Application {

	/**
   * There can be only one instance of Application, if no instance exist a new one
   * is created, if one instance already exist then it's the one returned.
   */
  constructor () {
    if (!Application.instance) {
			const Settings = require('./Settings')
			const GameState = require('./GameState')

      //Reference to electron
      this.remote = require('electron').remote

      //Application settings
      this.settings = Settings.initSettings()

      //Name of the tab the app is currently on (GAME by default)
      this.currentTab = 'GAME'

			//Module handling the current tab
			this.handler = null

      //Main dom element who contain the tab content
      this.tabContainer = $('.main')

      //Array containing the app windows (app & doc)
      this.windows = this.remote.getGlobal('windowsArray')

      //Dom element of the spinner used during tab loading
      this.loader = $('<div></div>').addClass('spinner')

			//Object containing all the informations on the state of the game
			this.gameState = GameState.initGameState()

      //State of the countdown
      this.countdown = null

			//Log of all the notifications issued since the start of the app
			this.notifLog = []

      //Only instance of Application
      Application.instance = this
    }

    return Application.instance
  }

  /**
   * Send a request to get an html file, and change the active tab.
   * Used to get the diffrent html file composing the app 'tabs'.
   * Call loadHtml() when completed.
   * @param {String} string Name of the request (in this case it's also the name of the tab)
   */
  requestHtml (string) {
		const Request = require('./Request')

    var request = Request.buildRequest(string, this.loadHtml)

    $('.main').html(this.loader)

    request.send()

    this.currentTab = string
  }

  /**
   * Callback function of the requestHtml request.
   * Load the html file recieved onto the main element.
   * @param {Object} response response from the request (jQuery ajax response)
   * @param {String} status response status from the request
   */
  loadHtml (response, status) {
		//Need to use this since in the context when the function is called 'this' reference the request object and not the application object
		const instance = require('./Application')

    if (status != 'success')
      instance.displayErrorNotification('.main', 'Erreur lors du chargment de la page, status : ' + status + ' (' + response.status + ').')

    var htmlpage = $(response.responseText)
		//Hide precedent content
    $('.main').hide()
		//Delete precedent content
    $('.main').html('')
		//Append new content
    $('.main').append(htmlpage)
		//Load and init handler
		instance.loadHandler()
		//Once everything is ready display new content
		$('.main').show()

    console.log('[CLIENT]: Tab ' + instance.currentTab + ' loaded')

    instance.setNavbarActive()
		$('[data-toggle="tooltip"]').tooltip()
  }

  /**
   * Control the active tab of the navbar header.
   * Remove the old active element and set the element with the id string to active.
   */
  setNavbarActive () {
		var id
		if ((this.currentTab == 'GAMEMODE') || (this.currentTab == 'GAMERULESET'))
			id = 'game'
		else
    	id = this.currentTab.toLowerCase()

    $('#' + id).parent().find('button').removeClass('sidebar-button-active')
    $('#' + id).addClass('sidebar-button-active')
  }

	/**
   * Called when the tab is loaded.
   * Load the handler corresponding to the tab,
   * init the handler and apply the settings on the newly loaded tab.
	 * Also a tab can not have a handler.
   */
	loadHandler () {
		const EnumHelper = require('./EnumHelper')

		this.handler = undefined

		for (var i in EnumHelper.TABS) {
			if (EnumHelper.TABS[i].name == this.currentTab)
				this.handler = require('./handlers/' + EnumHelper.TABS[i].handler)
		}

		if (this.handler != undefined)
			this.handler.init()

		this.settings.applySettings()
	}

  /**
   * Return the only instance of Application.
   * @static
   */
  static getInstance () {
    return Application.instance
  }

  /**
   * Toggle chromium dev tools on the app window.
   */
  toggleDevTools() {
    this.windows['app'].webContents.toggleDevTools({mode: 'bottom'})
  }

  /**
   * Send a message/event to the main process to display the documentation
   */
  displayDoc () {
    const {ipcRenderer} = require('electron')
    ipcRenderer.send('display-doc')
  }

  /**
   * Display an error notification.
   * Call displayNotification who handle the creation and display of the
   * notification.
   * @param {String} element identifier of the dom element who will append the notification
   * @param {String} message message to be displayed on the notification
   */
  displayErrorNotification (element, message) {
    this.displayNotification(element, message, 'danger')
  }

  /**
   * Display a success notification.
   * Call displayNotification who handle the creation and display of the
   * notification.
   * @param {String} element identifier of the dom element who will append the notification
   * @param {String} message message to be displayed on the notification
   */
  displaySuccessNotification (element, message) {
    this.displayNotification (element, message, 'success')
  }

  /**
   * Display a notification.
	 * Create a new notification and display it, the newly created notification is
	 * then added to the notification log list.
   * @param {String} element identifier of the DOM element who will append the notification
   * @param {String} message message to be displayed on the notification
   * @param {String} type type of the notification (error, success ...) correspond to bootsrap 4 colors (danger, warning, success and info)
	 * @see {@link Notification}
   */
  displayNotification (element, message, type) {
		const Notification = require('./Notification')

		var notif = new Notification(type, message)

		notif.display(element, this.settings.notifTimer)

		this.notifLog.push(notif)
  }

	/**
	 * Toggle the notification log.
	 * If the notification log is not already open will create a list of all the
	 * notifications present in the notifLog list.
	 * If the log is open will close it.
	 */
	toggleNotificationLog () {
		$('#notif-log').html('')

		if ($('#notif-log').is(':hidden')) {
			if (this.notifLog.length == 0)
			$('#notif-log').append('<h1><i class="fa fa-info-circle" aria-hidden="true"></i> Aucune notification.</h1>')
			else {
				for (var i = 0 ; i < this.notifLog.length ; i++) {
					var elem = $('<div></div>').append('<i class="fa fa-info-circle" aria-hidden="true"></i> ' + this.notifLog[i].date.toString())

					this.notifLog[i].display(elem, 0)

					$('#notif-log').append(elem)
				}
			}
			$('#notif-log').animateCss('slideInDown', 0.3)
			$('#notif-log').show()
		}
		else {
			$('#notif-log').animateCss('slideOutUp', 0.3, 0, () => {
				$('#notif-log').hide()
			})

		}
	}

	/**
	 * Display a popup window.
	 * Use the popup present in index.html.
	 * Take as parameters the title, content, text and event handlers for the buttons.
	 * The Strings parameters for the buttons can be empty.
	 * @param {String} title title text
	 * @param {String} content content text
	 * @param {String} leftButton left button text
	 * @param {String} rightButton right button text
	 * @param {function} leftButtonHandler left button onclick event handler
	 * @param {function} rightButtonHandler right button onclick event handler
	 */
	displayPopup (title, content, leftButton, rightButton, leftButtonHandler, rightButtonHandler) {
		$('#popup-title').text(title)
		$('#popup-body').text(content)

		if (leftButton.length > 0)
			$('#popup-button-left').text(leftButton)
		else
			$('#popup-button-left').hide()

		if (rightButton.length > 0)
			$('#popup-button-right').text(rightButton)
		else
			$('#popup-button-right').hide()

		if (leftButtonHandler != undefined)
			$('#popup-button-left').click(leftButtonHandler)

		if (leftButtonHandler != undefined)
			$('#popup-button-right').click(rightButtonHandler)

		$('#popup').modal('show')
	}

  /**
   * Return the memory usage of this process.
   * Return only the memory usage of the renderer process and not the main process.
   * @returns {Object} memory usage object
   */
  getMemoryUsage () {
    return this.remote.process.getProcessMemoryInfo()
  }

  /**
   * Return the process object (renderer process).
   * @returns {Object} process object
   */
  getProcess () {
    return this.remote.process
  }
}

module.exports = new Application()
