function handleAdminViewEmployee(request, ss) {
  const adminPersonalNumber = String(request.adminPersonalNumber || "");
  const adminPin = String(request.adminPin || "");
  const targetPersonalNumber = String(request.targetPersonalNumber || "");

  const jsonResponse = (payload) =>
    ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);

  if (!adminPersonalNumber || !adminPin || !targetPersonalNumber) {
    return jsonResponse({
      success: false,
      message: "Chybí údaje pro ověření administrátora nebo zaměstnance.",
    });
  }

  const employeeSheet = ss.getSheetByName("Zaměstnanci");
  const employeeRows = employeeSheet.getDataRange().getValues();
  const adminAuthenticated = employeeRows.slice(1).some(
    (row) =>
      String(row[1]) === adminPersonalNumber &&
      String(row[2]) === adminPin
  );

  if (!adminAuthenticated) {
    return jsonResponse({
      success: false,
      message: "Ověření administrátora se nezdařilo.",
    });
  }

  const adminUser = getUser(adminPersonalNumber);
  if (String(adminUser.role || "").trim().toLowerCase() !== "superadmin") {
    return jsonResponse({
      success: false,
      message: "Tuto akci může provést pouze superadmin.",
    });
  }

  const targetRow = employeeRows
    .slice(1)
    .find((row) => String(row[1]) === targetPersonalNumber);

  if (!targetRow) {
    return jsonResponse({
      success: false,
      message: "Zaměstnanec nebyl nalezen.",
    });
  }

  const employee = {
    name: targetRow[0],
    personalNumber: targetRow[1],
    shift: targetRow[3],
    position: targetRow[4],
    manager: targetRow[5],
    role: targetRow[6],
    bonusEligible: targetRow[7],
  };

  const errorsData = ss.getSheetByName("Chyby").getDataRange().getValues();
  const errors = [];
  for (let i = 1; i < errorsData.length; i++) {
    if (String(errorsData[i][0]) === targetPersonalNumber) {
      errors.push({
        osoba: errorsData[i][1],
        zpusobeno: errorsData[i][2],
        reseno: errorsData[i][3],
        kategorie: errorsData[i][4],
        reference: errorsData[i][5],
        popis: errorsData[i][6],
        foto: errorsData[i][7],
      });
    }
  }

  const benefitsData = ss.getSheetByName("PRINOSY").getDataRange().getValues();
  const benefits = [];
  for (let i = 1; i < benefitsData.length; i++) {
    if (String(benefitsData[i][1]) === targetPersonalNumber) {
      benefits.push({
        datum: benefitsData[i][0],
        title: benefitsData[i][3],
        description: benefitsData[i][4],
        status: benefitsData[i][5],
      });
    }
  }

  const targetUser = getUser(targetPersonalNumber);
  return jsonResponse({
    success: true,
    employee,
    userRole: targetUser.role || employee.role || "",
    errors,
    benefits,
    dochazkaBody: getDochazka(targetPersonalNumber).body,
  });
}
