import XCTest

final class HeaderGestures: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
    }

    private func launch(_ id: String) -> XCUIApplication {
        let app = XCUIApplication(bundleIdentifier: id)
        app.launch()
        XCTAssertTrue(app.webViews.staticTexts["FX"].firstMatch.waitForExistence(timeout: 30), app.debugDescription)
        return app
    }

    private func assertHeaderStaysAtInitialSize(_ app: XCUIApplication) {
        let logo = app.webViews.staticTexts["FX"].firstMatch
        let initial = logo.frame
        let title = app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Fiction eXchange")).firstMatch
        XCTAssertTrue(title.exists, app.debugDescription)
        let points = [CGVector(dx: initial.midX, dy: initial.midY),
                      CGVector(dx: title.frame.midX, dy: title.frame.midY),
                      CGVector(dx: initial.minX - 6, dy: initial.midY)]
        for point in points {
            app.coordinate(withNormalizedOffset: .zero).withOffset(point).doubleTap()
            let sameSize = NSPredicate { _, _ in
                abs(logo.frame.width - initial.width) < 1 && abs(logo.frame.minX - initial.minX) < 1
            }
            XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: sameSize, object: nil)], timeout: 3), .completed)
            // Wait through the native zoom animation before accepting equality.
            Thread.sleep(forTimeInterval: 0.7)
            XCTAssertEqual(logo.frame.width, initial.width, accuracy: 1, "Header smart-zoomed")
            XCTAssertEqual(logo.frame.minX, initial.minX, accuracy: 1, "Header panned")
        }
    }

    func testNegativeControlReproducesSmartZoom() {
        let app = launch("com.kakinymax.fxsurvival.gesturebaseline")
        let logo = app.webViews.staticTexts["FX"].firstMatch
        let initial = logo.frame
        logo.doubleTap()
        let zoomed = NSPredicate { _, _ in logo.frame.width > initial.width * 1.1 }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: zoomed, object: nil)], timeout: 5), .completed,
                       "Negative control did not reproduce native smart zoom; this runtime cannot verify the regression")
        app.terminate()
    }

    func testHeaderRulesAndOrders() {
        let app = launch("com.kakinymax.fxsurvival")
        assertHeaderStaysAtInitialSize(app)
        app.webViews.buttons["ルール"].tap()
        XCTAssertTrue(app.webViews.buttons["閉じる"].waitForExistence(timeout: 5))
        app.webViews.buttons["閉じる"].tap()
        app.webViews.buttons["1人でCPU対戦"].tap()
        let start = app.webViews.buttons["CPUと対戦を始める"]
        if !start.isHittable { app.swipeUp() }
        start.tap()
        app.swipeDown()
        assertHeaderStaysAtInitialSize(app)
        let sell = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "売り")).firstMatch
        sell.doubleTap()
        let submit = app.webViews.buttons["確定して全員分を公開"]
        XCTAssertTrue(submit.isHittable, app.debugDescription)
        submit.tap()
        XCTAssertFalse(submit.exists, "Order was not submitted")
        app.terminate()
    }
}
