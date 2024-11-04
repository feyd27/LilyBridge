// Initialize Foundation for the accordion menu and other components
$(document).ready(function() {
    $(document).foundation();  // Initialize Foundation for accordion and other components
  
    // Custom accordion speed control
    const animationSpeed = 1800;
    $('[data-accordion-menu] > li > a').on('click', function(e) {
      const clickedItem = $(this).closest('li');
      const nestedMenu = clickedItem.find('.nested');
      if (nestedMenu.length) {
        e.preventDefault();
  
        // Close other open nested menus
        $('[data-accordion-menu] > li > .nested').not(nestedMenu).slideUp(animationSpeed);
  
        // Toggle clicked nested menu
        nestedMenu.slideToggle(animationSpeed);
      }
    });
  });
  

