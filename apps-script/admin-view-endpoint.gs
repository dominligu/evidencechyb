function handleGetHistory(request, ss) {
  const personalNumber = String(
    request.personalNumber || request.osCislo || ""
  );
  const jsonResponse = (payload) =>
    ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);

  if (!personalNumber) {
    return jsonResponse({ success: false, message: "Chybí osobní číslo.", history: [] });
  }

  const sheet = ss.getSheetByName("HISTORY");
  if (!sheet) {
    return jsonResponse({ success: false, message: "List HISTORY nebyl nalezen.", history: [] });
  }

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) {
    return jsonResponse({ success: true, history: [] });
  }

  const headers = rows[0].map((header) =>
    String(header).trim().toLowerCase()
  );
  const getHeaderIndex = (...names) => {
    for (const name of names) {
      const index = headers.indexOf(name);
      if (index >= 0) return index;
    }
    return -1;
  };

  const personalIndex = getHeaderIndex("osobní číslo", "os cislo", "os_cislo", "personalnumber", "osobni cislo");
  const osobaIndex = getHeaderIndex("osoba", "jméno", "jmeno", "name");
  const causedIndex = getHeaderIndex("způsobeno", "zpusobeno", "datum", "date");
  const resolvedIndex = getHeaderIndex("řešeno", "reseno", "resolved");
  const categoryIndex = getHeaderIndex("kategorie", "category");
  const referenceIndex = getHeaderIndex("reference", "fa/obj/box", "fafobjbox");
  const descriptionIndex = getHeaderIndex("popis", "popis chyby", "description");
  const photoIndex = getHeaderIndex("foto", "photo", "fotka");

  const history = rows.slice(1)
    .filter((row) =>
      (personalIndex >= 0 ? String(row[personalIndex]) : String(row[0])) === personalNumber
    )
    .map((row) => ({
      osoba: osobaIndex >= 0 ? row[osobaIndex] : (row[1] || ""),
      zpusobeno: causedIndex >= 0 ? row[causedIndex] : (row[2] || ""),
      reseno: resolvedIndex >= 0 ? row[resolvedIndex] : (row[4] || ""),
      kategorie: categoryIndex >= 0 ? row[categoryIndex] : (row[5] || ""),
      reference: referenceIndex >= 0 ? row[referenceIndex] : (row[6] || ""),
      popis: descriptionIndex >= 0 ? row[descriptionIndex] : (row[7] || ""),
      foto: photoIndex >= 0 ? row[photoIndex] : (row[8] || ""),
    }));

  return jsonResponse({ success: true, history });
}

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
