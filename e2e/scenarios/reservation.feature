Feature: Campus resource reservation
  As a student
  I want to request a booking for a campus resource
  So that I can reserve it for a specific time slot without double-booking

  Background:
    Given the resource "Snell Library Room 101" exists and is available
    And I am on the CampusHub home page

  Scenario: Student successfully books an available resource
    Given "Snell Library Room 101" has no active reservations tomorrow between 10:00 and 11:00
    When I click the "Book" button for "Snell Library Room 101"
    And I set "Start time" to tomorrow at 10:00
    And I set "End time" to tomorrow at 11:00
    And I click "Request booking"
    Then I should see "Booking request submitted (status: PENDING)."
    And "My Bookings" should list "Snell Library Room 101" with status "PENDING"

  Scenario: Student is told the time slot is already reserved
    Given "Snell Library Room 101" has an active reservation tomorrow from 10:00 to 11:00
    When I click the "Book" button for "Snell Library Room 101"
    And I set "Start time" to tomorrow at 10:30
    And I set "End time" to tomorrow at 11:30
    And I click "Request booking"
    Then I should see "That time slot is already reserved. Please choose another time."
    And I should not see "Booking request submitted"
