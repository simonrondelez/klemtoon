/**
 * Form Handler for De Klemtoon Intake Questionnaires
 */

(function () {
  'use strict';

  let questionnaireData = null;
  let questionnaireType = null;
  let currentStep = 0;
  let totalSteps = 0;

  // Get questionnaire type from URL parameter
  function getQuestionnaireType() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('type');
  }

  // Load questionnaire JSON
  function loadQuestionnaire(type) {
    questionnaireType = type;

    console.log('Loading questionnaire:', type);
    const jsonPath = `forms/${type}.json`;
    console.log('Fetching from:', jsonPath);

    fetch(jsonPath)
      .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
          throw new Error(`Vragenlijst niet gevonden (status: ${response.status})`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Questionnaire data loaded successfully');
        questionnaireData = data;
        renderForm(data);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('intake-form').style.display = 'block';
      })
      .catch(error => {
        console.error('Error loading questionnaire:', error);
        console.error('Error details:', error.message);

        let errorMessage = 'De vragenlijst kon niet worden geladen. ';

        // Check if it's a CORS or file protocol error
        if (window.location.protocol === 'file:') {
          errorMessage = 'Deze pagina kan niet geopend worden via het file:// protocol. ' +
            'Start een lokale webserver of upload de bestanden naar uw website. ' +
            '<br><br>Voor lokaal testen, gebruik: <code>python3 -m http.server 8000</code> ' +
            'en open <a href="http://localhost:8000/intake/form.html?type=' + type + '">http://localhost:8000/intake/form.html?type=' + type + '</a>';
        } else {
          errorMessage += 'Probeer het later opnieuw of contacteer ons op info@deklemtoon.be<br><br>' +
            'Foutdetails: ' + error.message;
        }

        showError(errorMessage);
      });
  }

  // Show error message
  function showError(message) {
    document.getElementById('loading').style.display = 'none';
    const errorContainer = document.getElementById('error-container');
    errorContainer.innerHTML = `
      <div class="error-message">
        <h3><i class="fa fa-exclamation-triangle"></i> Fout</h3>
        <p>${message}</p>
        <a href="index.html" class="btn btn-primary" style="margin-top: 15px;">Terug naar overzicht</a>
      </div>
    `;
    errorContainer.style.display = 'block';
  }

  // Render form from JSON data
  function renderForm(data) {
    // Set title and description
    document.getElementById('form-title').textContent = data.title;
    document.getElementById('form-description').textContent = data.description;

    // Calculate total steps (therapist selection + sections + submit)
    totalSteps = data.sections.length + 2;
    document.getElementById('total-steps').textContent = totalSteps;

    // Render sections
    const sectionsContainer = document.getElementById('form-sections');
    sectionsContainer.innerHTML = '';

    data.sections.forEach((section, sectionIndex) => {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'form-section';
      sectionDiv.setAttribute('data-step', sectionIndex + 1);
      sectionDiv.innerHTML = `<h2>${section.title}</h2>`;

      section.questions.forEach((question, questionIndex) => {
        const questionDiv = createQuestionElement(question, sectionIndex, questionIndex);
        sectionDiv.appendChild(questionDiv);
      });

      // Add navigation buttons
      const navDiv = document.createElement('div');
      navDiv.className = 'form-navigation';
      navDiv.innerHTML = `
        <button type="button" class="btn-nav btn-secondary btn-prev">
          <i class="fa fa-arrow-left"></i> Vorige
        </button>
        <button type="button" class="btn-nav btn-next">
          Volgende <i class="fa fa-arrow-right"></i>
        </button>
      `;
      sectionDiv.appendChild(navDiv);

      sectionsContainer.appendChild(sectionDiv);
    });

    // Setup conditional field handlers
    setupConditionalFields();

    // Setup navigation
    setupNavigation();

    // Setup form submission
    const form = document.getElementById('intake-form');
    console.log('Setting up form submission handler on:', form);
    form.addEventListener('submit', handleSubmit);
    console.log('Form submit handler attached');

    // Setup email field validation
    setupEmailValidation();

    // Update progress bar
    updateProgress();
  }

  // Create question element based on type
  function createQuestionElement(question, sectionIndex, questionIndex) {
    const div = document.createElement('div');
    div.className = 'form-group';
    div.id = `question-${question.id}`;

    // Add conditional class if needed
    if (question.condition) {
      div.className += ' conditional-field';
      div.style.display = 'none';
      div.setAttribute('data-condition-field', question.condition.field);
      div.setAttribute('data-condition-value', question.condition.value);
    }

    const label = document.createElement('label');
    label.setAttribute('for', question.id);
    label.innerHTML = question.label;

    if (question.required) {
      label.innerHTML += '<span class="required">*</span>';
    }

    div.appendChild(label);

    let input;

    switch (question.type) {
      case 'text':
      case 'email':
      case 'tel':
        input = document.createElement('input');
        input.type = question.type;
        input.className = 'form-control';
        input.id = question.id;
        input.name = question.id;
        if (question.required) input.required = true;
        div.appendChild(input);
        break;

      case 'date':
        input = document.createElement('input');
        input.type = 'date';
        input.className = 'form-control';
        input.id = question.id;
        input.name = question.id;
        if (question.required) input.required = true;
        div.appendChild(input);
        break;

      case 'textarea':
        input = document.createElement('textarea');
        input.className = 'form-control';
        input.id = question.id;
        input.name = question.id;
        input.rows = 4;
        if (question.required) input.required = true;
        div.appendChild(input);
        break;

      case 'select':
        input = document.createElement('select');
        input.className = 'form-control';
        input.id = question.id;
        input.name = question.id;
        if (question.required) input.required = true;

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Selecteer een optie...';
        input.appendChild(defaultOption);

        question.options.forEach(option => {
          const opt = document.createElement('option');
          opt.value = option;
          opt.textContent = option;
          input.appendChild(opt);
        });

        div.appendChild(input);
        break;

      case 'radio':
        const radioGroup = document.createElement('div');
        radioGroup.className = 'radio-group';

        question.options.forEach((option, index) => {
          const radioWrapper = document.createElement('div');
          radioWrapper.style.marginBottom = '8px';

          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.id = `${question.id}_${index}`;
          radio.name = question.id;
          radio.value = option;
          if (question.required) radio.required = true;

          const radioLabel = document.createElement('label');
          radioLabel.setAttribute('for', `${question.id}_${index}`);
          radioLabel.textContent = option;

          radioWrapper.appendChild(radio);
          radioWrapper.appendChild(radioLabel);
          radioGroup.appendChild(radioWrapper);
        });

        div.appendChild(radioGroup);
        break;

      case 'checkbox':
        const checkboxGroup = document.createElement('div');
        checkboxGroup.className = 'checkbox-group';

        question.options.forEach((option, index) => {
          const checkboxWrapper = document.createElement('div');
          checkboxWrapper.style.marginBottom = '8px';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `${question.id}_${index}`;
          checkbox.name = question.id;
          checkbox.value = option;

          const checkboxLabel = document.createElement('label');
          checkboxLabel.setAttribute('for', `${question.id}_${index}`);
          checkboxLabel.textContent = option;

          checkboxWrapper.appendChild(checkbox);
          checkboxWrapper.appendChild(checkboxLabel);
          checkboxGroup.appendChild(checkboxWrapper);
        });

        div.appendChild(checkboxGroup);
        break;
    }

    return div;
  }

  // Setup conditional field visibility
  function setupConditionalFields() {
    const allFields = document.querySelectorAll('[data-condition-field]');

    allFields.forEach(field => {
      const conditionFieldId = field.getAttribute('data-condition-field');
      const conditionValue = field.getAttribute('data-condition-value');

      // Find the controlling field
      const controllingField = document.querySelector(`[name="${conditionFieldId}"]`);

      if (controllingField) {
        // Add event listeners
        if (controllingField.type === 'radio') {
          const radioButtons = document.querySelectorAll(`[name="${conditionFieldId}"]`);
          radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
              updateConditionalField(field, conditionFieldId, conditionValue);
            });
          });
        } else {
          controllingField.addEventListener('change', () => {
            updateConditionalField(field, conditionFieldId, conditionValue);
          });
        }
      }
    });
  }

  // Update conditional field visibility
  function updateConditionalField(field, conditionFieldId, conditionValue) {
    const controllingField = document.querySelector(`[name="${conditionFieldId}"]:checked`) ||
      document.querySelector(`[name="${conditionFieldId}"]`);

    if (controllingField && controllingField.value === conditionValue) {
      field.style.display = 'block';
      // Make required if parent is visible
      const input = field.querySelector('input, textarea, select');
      if (input && field.querySelector('label .required')) {
        input.required = true;
      }
    } else {
      field.style.display = 'none';
      // Remove required if hidden
      const input = field.querySelector('input, textarea, select');
      if (input) {
        input.required = false;
        // Clear value when hidden
        if (input.type === 'checkbox' || input.type === 'radio') {
          input.checked = false;
        } else {
          input.value = '';
        }
      }
    }
  }

  // Collect form data
  function collectFormData() {
    const formData = {};
    const form = document.getElementById('intake-form');
    const formElements = form.elements;

    for (let i = 0; i < formElements.length; i++) {
      const element = formElements[i];

      // Skip buttons and fieldsets
      if (element.type === 'submit' || element.type === 'button' || element.tagName === 'FIELDSET') {
        continue;
      }

      // Skip hidden conditional fields (don't include them in submission)
      const parentDiv = element.closest('.conditional-field');
      if (parentDiv && parentDiv.style.display === 'none') {
        continue;
      }

      const name = element.name;
      const value = element.value;

      // Handle different input types
      if (element.type === 'checkbox') {
        if (element.checked) {
          if (!formData[name]) {
            formData[name] = [];
          }
          formData[name].push(value);
        }
      } else if (element.type === 'radio') {
        if (element.checked) {
          formData[name] = value;
        }
      } else if (value.trim() !== '') {
        // Only include non-empty values
        formData[name] = value;
      }
    }

    // Convert checkbox arrays to comma-separated strings
    Object.keys(formData).forEach(key => {
      if (Array.isArray(formData[key])) {
        formData[key] = formData[key].join(', ');
      }
    });

    return formData;
  }

  // Format email body
  function formatEmailBody(formData) {
    let body = `INTAKE VRAGENLIJST: ${questionnaireData.title}\n`;
    body += '='.repeat(60) + '\n\n';

    questionnaireData.sections.forEach(section => {
      body += `\n${section.title}\n`;
      body += '-'.repeat(section.title.length) + '\n\n';

      section.questions.forEach(question => {
        // Skip conditional questions that aren't visible
        if (question.condition) {
          const conditionMet = formData[question.condition.field] === question.condition.value;
          if (!conditionMet) {
            return;
          }
        }

        const value = formData[question.id];

        // Only include if there's a value
        if (value !== undefined && value !== '') {
          body += `${question.label}\n`;
          body += `${value}\n\n`;
        }
      });
    });

    // Add therapist preference
    const therapist = formData.therapist;
    if (therapist) {
      body += '\n' + '='.repeat(60) + '\n';
      body += `\nVOORKEUR LOGOPEDIST: ${getTherapistName(therapist)}\n`;
    } else {
      body += '\n' + '='.repeat(60) + '\n';
      body += '\nVOORKEUR LOGOPEDIST: Geen voorkeur\n';
    }

    body += '\n' + '='.repeat(60) + '\n';
    body += '\nVerzonden via deklemtoon.be intake formulier\n';

    return body;
  }

  // Get therapist name from email
  function getTherapistName(email) {
    const therapists = {
      'sofie@deklemtoon.be': 'Sofie Maes',
      'nina@deklemtoon.be': 'Nina Piens',
      'evelien@deklemtoon.be': 'Evelien Van Dycke',
      'angelique@deklemtoon.be': 'Angelique Sardeur',
      'aaricia@deklemtoon.be': 'Aaricia Serreyn',
      'romy@deklemtoon.be': 'Romy Bruggeman'
    };
    return therapists[email] || email;
  }

  // Determine email recipients
  function getEmailRecipients(therapistEmail) {
    if (therapistEmail) {
      // Send to therapist with CC to info
      return {
        to: therapistEmail,
        cc: 'info@deklemtoon.be'
      };
    } else {
      // Send to info only
      return {
        to: 'info@deklemtoon.be',
        cc: null
      };
    }
  }

  // Handle form submission
  function handleSubmit(e) {
    console.log('handleSubmit called');
    e.preventDefault();

    // Show loading state
    const submitButton = document.querySelector('button[type="submit"]');
    console.log('Submit button found:', submitButton);

    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Verzenden...';

    // Collect form data
    const formData = collectFormData();
    console.log('Form data collected:', formData);

    // Validate email field
    if (!formData.email || !isValidEmail(formData.email)) {
      alert('Gelieve een geldig e-mailadres in te vullen (bijv. naam@voorbeeld.be)');
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonText;
      return;
    }

    console.log('Calling sendEmails...');
    // Send email via mailto
    sendEmails(formData, submitButton, originalButtonText);
  }

  // Send email using mailto link
  function sendEmails(formData, submitButton, originalButtonText) {
    console.log('sendEmails called');
    try {
      // Get email recipients
      const recipients = getEmailRecipients(formData.therapist);
      console.log('Recipients:', recipients);

      // Build mailto link
      const subject = `Intake: ${questionnaireData.title} - ${formData.naam_kind || 'Nieuwe aanmelding'}`;
      const body = formatEmailBody(formData);
      console.log('Email body length:', body.length);

      // Build email addresses (to + optional CC)
      let mailto = `mailto:${recipients.to}`;
      const params = [];

      if (recipients.cc) {
        params.push(`cc=${encodeURIComponent(recipients.cc)}`);
      }

      params.push(`subject=${encodeURIComponent(subject)}`);
      params.push(`body=${encodeURIComponent(body)}`);

      mailto += '?' + params.join('&');
      console.log('Mailto link created, length:', mailto.length);

      // Open email client
      console.log('Opening email client...');
      window.location.href = mailto;

      // Show message and redirect after short delay
      setTimeout(() => {
        alert('Uw email programma is geopend. Vergeet niet om de email te verzenden!\n\nAls uw email programma niet opent, contacteer ons op info@deklemtoon.be');
        window.location.href = `confirmation.html?type=${questionnaireType}`;
      }, 1000);

    } catch (error) {
      console.error('Failed to open email client', error);
      alert('Er is een fout opgetreden. Contacteer ons op info@deklemtoon.be');
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonText;
    }
  }

  // Setup navigation handlers
  function setupNavigation() {
    // Get all next and previous buttons
    const nextButtons = document.querySelectorAll('.btn-next, #btn-next');
    const prevButtons = document.querySelectorAll('.btn-prev, #btn-prev, #btn-prev-final');

    nextButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (validateCurrentStep()) {
          goToStep(currentStep + 1);
        }
      });
    });

    prevButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        goToStep(currentStep - 1);
      });
    });
  }

  // Validate current step
  function validateCurrentStep() {
    const currentSection = document.querySelector(`.form-section[data-step="${currentStep}"]`);
    if (!currentSection) return true;

    // Get all required fields in current section that are visible
    const requiredFields = currentSection.querySelectorAll('[required]');
    let isValid = true;
    let firstInvalidField = null;

    requiredFields.forEach(field => {
      // Skip if parent is hidden (conditional field)
      const parentDiv = field.closest('.form-group');
      if (parentDiv && parentDiv.style.display === 'none') {
        return;
      }

      // Check if field is filled
      if (field.type === 'radio') {
        const radioGroup = currentSection.querySelectorAll(`[name="${field.name}"]`);
        const isChecked = Array.from(radioGroup).some(radio => radio.checked);
        if (!isChecked && !firstInvalidField) {
          isValid = false;
          firstInvalidField = field;
          field.closest('.form-group').style.borderLeft = '3px solid #d9534f';
        } else {
          field.closest('.form-group').style.borderLeft = 'none';
        }
      } else if (field.type === 'checkbox') {
        // Checkboxes are usually not required individually
      } else {
        if (!field.value.trim()) {
          isValid = false;
          if (!firstInvalidField) {
            firstInvalidField = field;
          }
          field.style.borderColor = '#d9534f';
        } else {
          // Additional validation for email fields
          if (field.type === 'email' && !isValidEmail(field.value.trim())) {
            isValid = false;
            if (!firstInvalidField) {
              firstInvalidField = field;
            }
            field.style.borderColor = '#d9534f';
            // Show error message if it exists
            const errorMsg = field.nextElementSibling;
            if (errorMsg && errorMsg.className === 'email-error-message') {
              errorMsg.style.display = 'block';
            }
          } else {
            field.style.borderColor = '#ddd';
          }
        }
      }
    });

    if (!isValid) {
      alert('Vul alle verplichte velden (gemarkeerd met *) in voordat u verder gaat.');
      if (firstInvalidField) {
        firstInvalidField.focus();
      }
    }

    return isValid;
  }

  // Validate email format using regex
  function isValidEmail(email) {
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Setup email field validation
  function setupEmailValidation() {
    const emailFields = document.querySelectorAll('input[type="email"]');

    emailFields.forEach(emailField => {
      // Create error message element
      const errorMessage = document.createElement('div');
      errorMessage.className = 'email-error-message';
      errorMessage.style.display = 'none';
      errorMessage.style.color = '#d9534f';
      errorMessage.style.fontSize = '14px';
      errorMessage.style.marginTop = '5px';
      errorMessage.textContent = 'Gelieve een geldig e-mailadres in te vullen (bijv. naam@voorbeeld.be)';

      // Insert error message after the input field
      emailField.parentNode.insertBefore(errorMessage, emailField.nextSibling);

      // Validate on blur (when user leaves the field)
      emailField.addEventListener('blur', function () {
        const value = this.value.trim();

        if (value === '') {
          // Empty field - remove error styling
          this.style.borderColor = '#ddd';
          errorMessage.style.display = 'none';
        } else if (!isValidEmail(value)) {
          // Invalid email - show error
          this.style.borderColor = '#d9534f';
          errorMessage.style.display = 'block';
        } else {
          // Valid email - show success
          this.style.borderColor = '#5cb85c';
          errorMessage.style.display = 'none';
        }
      });

      // Clear error styling when user starts typing
      emailField.addEventListener('input', function () {
        if (this.value.trim() === '') {
          this.style.borderColor = '#ddd';
          errorMessage.style.display = 'none';
        }
      });
    });
  }

  // Go to specific step
  function goToStep(step) {
    if (step < 0 || step >= totalSteps) return;

    // Hide all sections
    const allSections = document.querySelectorAll('.form-section');
    allSections.forEach(section => {
      section.classList.remove('active');
    });

    // Show target section
    const targetSection = document.querySelector(`.form-section[data-step="${step}"]`);
    if (step === totalSteps - 1) {
      // Last step (submit section)
      document.getElementById('submit-section').classList.add('active');
    } else if (targetSection) {
      targetSection.classList.add('active');
    }

    currentStep = step;
    updateProgress();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Update progress bar
  function updateProgress() {
    const progressBar = document.getElementById('progress-bar');
    const currentStepSpan = document.getElementById('current-step');

    const progress = ((currentStep + 1) / totalSteps) * 100;
    progressBar.style.width = progress + '%';
    currentStepSpan.textContent = currentStep + 1;
  }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', function () {
    const type = getQuestionnaireType();

    if (!type) {
      showError('Geen vragenlijst geselecteerd. Kies een vragenlijst vanuit het overzicht.');
      return;
    }

    loadQuestionnaire(type);
  });

})();
